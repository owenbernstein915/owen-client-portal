import { analyticsRanges } from '../public/analytics-ranges.mjs';

// Netlify's published Web Analytics definition of a page view. Do not count
// images, scripts, redirects or errors as page views, or estimate visitors.
export const pageViewFilters = [
  { field: 'ContentType', op: '=', value: 'text/html' },
  ...[200, 201, 304].map(value => ({ field: 'StatusCode', op: '=', value })),
];
const minute = 60000;
const validNumber = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function makeNetlifyAnalytics({ env, external, fail, now = Date.now }) {
  return async function netlifyAnalytics(client, range, { diagnostics = false } = {}) {
    if (!Object.hasOwn(analyticsRanges, range)) fail(400, 'Choose Last Hour, Last 24 Hours, or Last 7 Days.');
    const siteId = env[client.netlifySiteIdEnv];
    const token = env.NETLIFY_ANALYTICS_TOKEN || env.NETLIFY_API_TOKEN;
    if (!siteId || !token) fail(503, 'The Netlify analytics connection needs to be configured by Owen.');
    const config = analyticsRanges[range];
    // Query complete minutes: Netlify time-series buckets otherwise include
    // events outside the selected range. The displayed end is exclusive.
    const to = Math.floor(now() / minute) * minute;
    const requestedFrom = to - config.minutes * minute;
    let from = requestedFrom;
    const invalid = (reason = 'response shape') => fail(503, `Netlify returned an incomplete analytics report.${diagnostics ? ` Check: ${reason}.` : ''} Please refresh; no estimated counts are shown.`);

    async function query(type, queries) {
      // Match the official client's one-query-per-request contract.
      if (queries.length > 1) {
        const parts = await Promise.all(queries.map(item => query(type, [item])));
        return { data: parts.flatMap(part => part.data), meta: { responses: parts.flatMap(part => part.meta.responses) } };
      }
      const params = new URLSearchParams({ from_ts: String(from), to_ts: String(to - 1) });
      if (type === 'timeseries') params.set('interval', String(minute));
      const response = await external(`https://api.netlify.com/api/v1/sites/${encodeURIComponent(siteId)}/observability/query/${type}?${params}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ data: [{ attributes: { queries } }] }),
      });
      if (!response.ok) {
        let detail = '';
        if (diagnostics) {
          const error = await response.json().catch(() => ({}));
          const message = error.msg || error.message || error.error;
          if (typeof message === 'string') detail = ` ${message.replaceAll(token, '[redacted]').slice(0,200)}`;

        }
        fail(503, `Netlify analytics is temporarily unavailable (HTTP ${response.status}).${detail} Please refresh or contact Owen.`);
      }
      let data;
      try { data = await response.json(); } catch { invalid(`${type} JSON`); }
      if (!Array.isArray(data?.data) || !Array.isArray(data?.meta?.responses) || data.meta.responses.length !== queries.length) invalid(`${type} response shape`);
      for (const meta of data.meta.responses) {
        if (!Number.isFinite(meta.from) || meta.from < from || meta.to !== to - 1 || meta.limited) invalid(`${type} window metadata`);
        if (type === 'timeseries' && meta.interval !== minute) invalid('time-series interval');
      }
      return data;
    }
    const read = () => Promise.all([
      query('counts', [{ name: 'status_codes', filters: pageViewFilters }, { name: 'methods' }]),
      query('timeseries', [{ name: 'edge_requests_count', filters: pageViewFilters }, { name: 'edge_requests_bandwidth' }]),
      query('topk', ['urls', 'referrers', 'client_countries'].map(name => ({ name, filters: pageViewFilters, page: 1, per_page: 10, sort_by: [{ field: 'Count', order: 'DESC' }] }))),
    ]);
    let reports;
    for (let attempt = 0; attempt < 3; attempt++) {
      reports = await read();
      const earliestAvailable = Math.max(...reports.flatMap(report => report.meta.responses.map(meta => meta.from)));
      if (earliestAvailable === from) break;
      // Seven-day retention advances while a request is in flight. Retry all
      // metrics with the same first complete available minute, never combine
      // reports with different effective windows or imply older data exists.
      if (range !== '7d' || earliestAvailable - requestedFrom > 2 * minute || attempt === 2) invalid('rolling retention boundary');
      from = Math.ceil(earliestAvailable / minute) * minute;
    }
    if (reports.some(report => report.meta.responses.some(meta => meta.from !== from))) invalid('inconsistent source windows');
    const [counts, series, rankings] = reports;
    const attributes = (report, name) => {
      const matches = report.data.filter(row => row.type === `${name}_response`);
      if (matches.length !== 1 || !matches[0].attributes) invalid(`${name} attributes`);
      return matches[0].attributes;
    };
    const items = (report, name) => {
      const rows = attributes(report, name).items;
      if (!Array.isArray(rows) || rows.some(row => !validNumber(row.count) || !Number.isInteger(row.count))) invalid(`${name} counts`);
      return rows;
    };
    const sum = rows => rows.reduce((n, row) => n + row.count, 0);
    const values = name => {
      const data = attributes(series, name);
      if (!Array.isArray(data.times) || !Array.isArray(data.values) || !Array.isArray(data.series) || data.values.length !== data.series.length) invalid(`${name} series shape`);
      if (data.times.some((time, i) => !Number.isInteger(time) || time < from || time >= to || time % minute || (i > 0 && time <= data.times[i - 1]))) invalid(`${name} timestamps`);
      if (data.values.some(row => !Array.isArray(row) || row.length !== data.times.length || row.some(value => !validNumber(value)))) invalid(`${name} series values`);
      return data.times.map((time, i) => ({ time, value: data.values.reduce((n, row) => n + row[i], 0) }));
    };
    const pageViews = sum(items(counts, 'status_codes'));
    const requests = sum(items(counts, 'methods'));
    const minuteViews = values('edge_requests_count');
    const bandwidthBytes = values('edge_requests_bandwidth').reduce((n, row) => n + row.value, 0);
    // Chart the same minute data for each window; only presentation grouping
    // changes (one minute / one hour / six hours). Never scale or sample counts.
    const bucketSize = config.chartMinutes * minute;
    const buckets = Array.from({ length: Math.ceil((to - from) / bucketSize) }, (_, i) => ({
      from: new Date(from + i * bucketSize).toISOString(),
      to: new Date(Math.min(to, from + (i + 1) * bucketSize)).toISOString(),
      views: 0,
    }));
    for (const row of minuteViews) buckets[Math.floor((row.time - from) / bucketSize)].views += row.value;
    const chartTotal = buckets.reduce((n, row) => n + row.views, 0);
    const ranking = name => items(rankings, name).map(row => ({ label: String(row.key || (name === 'referrers' ? 'Direct / no referrer' : 'Unknown')), views: row.count }));
    return {
      siteId: client.id, source: 'netlify', sourceProduct: 'Netlify Observability', range,
      requestedFrom: new Date(requestedFrom).toISOString(), from: new Date(from).toISOString(), to: new Date(to).toISOString(),
      updatedAt: new Date(now()).toISOString(), coverageLimited: from !== requestedFrom,
      pageViews, requests, bandwidthBytes, buckets,
      // Independent Netlify queries can see late-arriving logs at different
      // moments. Keep its count total authoritative and state any difference.
      chartPending: chartTotal !== pageViews,
      pages: ranking('urls'), sources: ranking('referrers'), locations: ranking('client_countries'),
    };
  };
}
