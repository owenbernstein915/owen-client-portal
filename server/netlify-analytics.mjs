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
  return async function netlifyAnalytics(client, range) {
    if (!Object.hasOwn(analyticsRanges, range)) fail(400, 'Choose Last Hour, Last 24 Hours, or Last 7 Days.');
    const siteId = env[client.netlifySiteIdEnv];
    if (!siteId || !env.NETLIFY_API_TOKEN) fail(503, 'The Netlify analytics connection needs to be configured by Owen.');
    const config = analyticsRanges[range];
    // Query complete minutes: Netlify time-series buckets otherwise include
    // events outside the selected range. The displayed end is exclusive.
    const to = Math.floor(now() / minute) * minute;
    const requestedFrom = to - config.minutes * minute;
    let from = requestedFrom;
    const invalid = () => fail(503, 'Netlify returned an incomplete analytics report. Please refresh; no estimated counts are shown.');

    async function query(type, queries) {
      // Match the official client's one-query-per-request contract. Some
      // Netlify endpoints reject a multi-query payload even though it is an array.
      if (queries.length > 1) {
        const parts = await Promise.all(queries.map(item => query(type, [item])));
        return { data: parts.flatMap(part => part.data), meta: { responses: parts.flatMap(part => part.meta.responses) } };
      }
      const params = new URLSearchParams({ from_ts: String(from), to_ts: String(to - 1) });
      if (type === 'timeseries') params.set('interval', String(minute));
      const response = await external(`https://api.netlify.com/api/v1/sites/${encodeURIComponent(siteId)}/observability/query/${type}?${params}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${env.NETLIFY_API_TOKEN}`, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ data: [{ attributes: { queries } }] }),
      });
      if (!response.ok) fail(503, `Netlify analytics is temporarily unavailable (HTTP ${response.status}). Please refresh or contact Owen.`);
      let data;
      try { data = await response.json(); } catch { invalid(); }
      if (!Array.isArray(data?.data) || !Array.isArray(data?.meta?.responses) || data.meta.responses.length !== queries.length) invalid();
      for (const meta of data.meta.responses) {
        if (!Number.isFinite(meta.from) || meta.from < from || meta.to !== to - 1 || meta.limited) invalid();
        if (type === 'timeseries' && meta.interval !== minute) invalid();
      }
      return data;
    }
    const read = () => Promise.all([
      query('counts', [{ name: 'status_codes', filters: pageViewFilters }, { name: 'methods' }]),
      query('timeseries', [{ name: 'edge_requests_count', filters: pageViewFilters }, { name: 'edge_requests_bandwidth' }]),
      query('topk', ['urls', 'referrers', 'client_countries'].map(name => ({ name, filters: pageViewFilters, page: 1, per_page: 10, sort_by: [{ field: 'Count', order: 'DESC' }] }))),
    ]);
    let reports = await read();
    const earliestAvailable = Math.max(...reports.flatMap(report => report.meta.responses.map(meta => meta.from)));
    if (earliestAvailable > from) {
      // Seven-day retention advances while a request is in flight. Retry all
      // metrics with the same first complete available minute, never combine
      // reports with different effective windows or imply older data exists.
      if (range !== '7d' || earliestAvailable - from > 2 * minute) invalid();
      from = Math.ceil(earliestAvailable / minute) * minute;
      reports = await read();
    }
    if (reports.some(report => report.meta.responses.some(meta => meta.from !== from))) invalid();
    const [counts, series, rankings] = reports;
    const attributes = (report, name) => {
      const matches = report.data.filter(row => row.type === `${name}_response`);
      if (matches.length !== 1 || !matches[0].attributes) invalid();
      return matches[0].attributes;
    };
    const items = (report, name) => {
      const rows = attributes(report, name).items;
      if (!Array.isArray(rows) || rows.some(row => !validNumber(row.count) || !Number.isInteger(row.count))) invalid();
      return rows;
    };
    const sum = rows => rows.reduce((n, row) => n + row.count, 0);
    const values = name => {
      const data = attributes(series, name);
      if (!Array.isArray(data.times) || !Array.isArray(data.values) || !Array.isArray(data.series) || data.values.length !== data.series.length) invalid();
      if (data.times.some((time, i) => !Number.isInteger(time) || time < from || time >= to || time % minute || (i > 0 && time <= data.times[i - 1]))) invalid();
      if (data.values.some(row => !Array.isArray(row) || row.length !== data.times.length || row.some(value => !validNumber(value)))) invalid();
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
