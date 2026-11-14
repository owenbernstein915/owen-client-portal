import { historicalAnalyticsPanel } from './analytics-history.mjs';
import { analyticsRanges } from './analytics-ranges.mjs';

export function analyticsPanel({ el, button, data, loading, error, range, changeRange, refresh, siteName, liveUrl }) {
  const number = n => new Intl.NumberFormat().format(n);
  const timestamp = value => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }).format(new Date(value));
  const time = value => el('time', { datetime: value }, `${timestamp(value)} UTC`);
  const metric = (id, label, value, note, title) => el('article', { class: 'analytics-metric', 'data-metric': id }, el('p', {}, label), el('strong', { title }, value), el('small', {}, note));
  const ranking = (title, rows) => el('section', { class: 'analytics-ranking' }, el('h2', {}, title), rows.length ? el('ol', {}, ...rows.map(row => el('li', {}, el('span', { title: row.label }, row.label), el('strong', {}, number(row.views))))) : el('p', { class: 'muted' }, 'No page views reported for this window.'));
  const main = el('main', { class: 'main analytics-main' },
    el('header', { class: 'topbar' }, el('div', {}, el('p', { class: 'eyebrow' }, siteName), el('h1', {}, 'Website analytics')),
      el('a', { class: 'button', href: liveUrl, target: '_blank', rel: 'noopener noreferrer' }, 'View live site')),
    el('div', { class: 'analytics-controls' }, el('p', { class: 'muted' }, 'Netlify traffic for the selected window. Refreshes every minute.'),
      el('div', { class: 'analytics-range' }, el('label', { for: 'analytics-range' }, 'Live tracking range'),
        el('select', { id: 'analytics-range', disabled: loading, onChange: e => changeRange(e.target.value) }, ...Object.entries(analyticsRanges).map(([key, value]) => el('option', { value: key, selected: key === range }, value.label))),
        button(loading ? 'Refreshing…' : 'Refresh', refresh, 'button', { disabled: loading }))),
    el('div', { 'aria-live': 'polite', role: 'status', class: 'analytics-update' }, loading ? 'Fetching this window from Netlify…' : error ? 'The live Netlify report could not be refreshed.' : data ? ['Fetched from Netlify ', time(data.updatedAt)] : ''),
  );
  if (error) {
    main.append(el('div', { class: 'warning', role: 'alert' }, error, button('Try again', refresh, 'button')));
    if (data?.historical) main.append(el('details', { class: 'analytics-saved-report' }, el('summary', {}, 'Saved 30-day Netlify report · November 14, 2026'), historicalAnalyticsPanel({el,history:data.historical})));
    return main;
  }
  if (!data) return main;
  main.append(el('section', { class: 'analytics-window', 'aria-label': 'Selected Netlify time window' },
    el('div', {}, el('p', { class: 'eyebrow' }, 'NETLIFY'), el('h2', {}, analyticsRanges[data.range].label)),
    el('p', {}, time(data.from), ' – ', time(data.to))));
  if (data.coverageLimited) main.append(el('p', { class: 'analytics-footnote' }, 'Netlify’s rolling seven-day retention excludes the first partial minute. The exact available window is shown above.'));
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unit = Math.min(4, Math.floor(Math.log10(Math.max(1, data.bandwidthBytes)) / 3));
  const bandwidth = `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(data.bandwidthBytes / (1000 ** unit))} ${units[unit]}`;
  main.append(el('div', { class: 'analytics-metrics' },
    metric('pageviews', 'Page views', number(data.pageViews), 'Successful HTML pages served by Netlify'),
    metric('requests', 'Web requests', number(data.requests), 'All Netlify requests, including page assets'),
    metric('bandwidth', 'Data served', bandwidth, `${number(data.bandwidthBytes)} bytes in this window`, `${number(data.bandwidthBytes)} bytes`)));
  if (!data.requests) main.append(el('section', { class: 'analytics-empty' }, el('h2', {}, 'No requests in this window.'), el('p', {}, 'Netlify reported zero requests for this site in the selected period.')));
  const buckets = data.buckets;
  const chart = el('section', { class: 'analytics-chart' }, el('div', { class: 'analytics-chart-heading' }, el('h2', {}, 'Page views over time'), el('span', { class: 'muted' }, range === '1h' ? 'One-minute totals · UTC' : range === '24h' ? 'Hourly totals · UTC' : 'Six-hour totals · UTC')));
  const svgNode = (tag, attrs) => { const node = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [key,value] of Object.entries(attrs)) node.setAttribute(key, String(value)); return node; };
  const svg = svgNode('svg', { viewBox: '0 0 800 190', role: 'img', 'aria-label': `Netlify page views for ${analyticsRanges[data.range].label}. Exact figures are in the table below.` });
  const max = Math.max(1, ...buckets.map(row => row.views));
  for (const y of [20,95,170]) svg.append(svgNode('line', { x1: 0, x2: 800, y1: y, y2: y, class: 'analytics-gridline' }));
  const width = 800 / Math.max(1,buckets.length);
  buckets.forEach((row,i) => { const height = row.views / max * 150; const rect = svgNode('rect', { x: i*width + width*.18, y:170-height, width:width*.64, height, rx:2, class:'analytics-bar' }); const title = svgNode('title',{}); title.textContent = `${timestamp(row.from)} – ${timestamp(row.to)} UTC: ${number(row.views)} page views`; rect.append(title); svg.append(rect); });
  chart.append(svg, el('div', { class: 'analytics-chart-axis' }, el('span', {}, timestamp(data.from)), el('span', {}, `${number(buckets.reduce((n,row) => n + row.views, 0))} page views charted`), el('span', {}, timestamp(data.to))));
  if (data.chartPending) chart.append(el('p', { class: 'analytics-footnote' }, 'Netlify is still processing recent requests. Its chart and count queries currently differ; the page-view total above is Netlify’s count query. Refresh to check again.'));
  chart.append(el('details', { class: 'analytics-daily' }, el('summary', {}, 'View exact time-window figures'), el('div', { class: 'analytics-table-wrap' }, el('table', {}, el('caption', {}, 'Netlify page views · UTC · interval end excluded'), el('thead', {}, el('tr', {}, el('th', {scope:'col'}, 'From'), el('th', {scope:'col'}, 'To'), el('th', {scope:'col'}, 'Page views'))), el('tbody', {}, ...buckets.map(row => el('tr', {}, el('th', {scope:'row'}, timestamp(row.from)), el('td', {}, timestamp(row.to)), el('td', {}, number(row.views)))))))));
  main.append(chart, el('div', { class: 'analytics-rankings' }, ranking('Top pages',data.pages), ranking('Traffic sources',data.sources), ranking('Locations',data.locations)),
    el('p', { class:'analytics-footnote' }, 'Source: Netlify Observability for this project. Every total, chart and breakdown above uses the selected window, ending at the last complete minute. Page views follow Netlify’s HTML response and success-status rules (200, 201, 304). Requests and data served include assets and errors; automated traffic is included. Recent requests may take time to reach Netlify’s reports. Visitor estimates from the browser tracker are not used.'));
  if (data.historical) main.append(el('details', { class: 'analytics-saved-report' }, el('summary', {}, 'Saved 30-day Netlify report · November 14, 2026'), historicalAnalyticsPanel({el,history:data.historical})));
  if (data.historyError) main.append(el('p', { class: 'muted' }, data.historyError));
  return main;
}
