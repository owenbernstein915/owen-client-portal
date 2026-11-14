import { historicalAnalyticsPanel } from './analytics-history.mjs';

export function analyticsPanel({ el, button, data, loading, error, days, changeDays, refresh, siteName, liveUrl }) {
  const number = n => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n || 0);
  const date = d => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(d));
  const metric = (label, value, note) => el('article', { class: 'analytics-metric' }, el('p', {}, label), el('strong', {}, value), el('small', {}, note));
  const ranking = (title, rows) => el('section', { class: 'analytics-ranking' }, el('h2', {}, title), rows?.length ? el('ol', {}, ...rows.map(row => el('li', {}, el('span', { title: row.label }, row.label), el('strong', {}, number(row.views))))) : el('p', { class: 'muted' }, 'Traffic will appear here as people visit.'));
  const main = el('main', { class: 'main analytics-main' },
    el('header', { class: 'topbar' }, el('div', {}, el('p', { class: 'eyebrow' }, siteName), el('h1', {}, 'Website analytics')),
      el('a', { class: 'button', href: liveUrl, target: '_blank', rel: 'noopener noreferrer' }, 'View live site')),
    el('div', { class: 'analytics-controls' }, el('p', { class: 'muted' }, 'See how people find and explore your website.'),
      el('div', { class: 'analytics-range' }, el('label', { for: 'analytics-days' }, 'Live tracking range'),
        el('select', { id: 'analytics-days', disabled: loading, onChange: e => changeDays(Number(e.target.value)) }, ...[7,30,90].map(n => el('option', { value: n, selected: n === days }, `Last ${n} days`))),
        button(loading ? 'Refreshing…' : 'Refresh', refresh, 'button', { disabled: loading }))),
    el('div', { 'aria-live': 'polite', role: 'status', class: 'analytics-update' }, loading ? 'Loading your website’s traffic…' : data ? `Updated ${new Date(data.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · Daily totals use UTC` : ''),
  );
  if (error) { main.append(el('div', { class: 'warning', role: 'alert' }, error, button('Try again', refresh, 'button'))); return main; }
  if (!data) return main;
  if(data.historical) main.append(historicalAnalyticsPanel({el,history:data.historical}));
  if(data.historyError) main.append(el('p',{class:'warning',role:'alert'},data.historyError));
  main.append(el('div',{class:'analytics-history-heading'},el('div',{},el('p',{class:'eyebrow'},'LIVE TRACKING'),el('h2',{},'Current website activity')),el('p',{class:'muted'},`Since ${date(data.trackingStartedAt)}`)));
  if (!data.pageViews) main.append(el('section', { class: 'analytics-empty' }, el('h2', {}, 'Ready for your next visitor.'), el('p', {}, `Tracking started ${date(data.trackingStartedAt)}. Your first page views will appear here automatically. Traffic from before tracking was installed isn’t available.`)));
  main.append(el('div', { class: 'analytics-metrics' },
    metric('Page views', number(data.pageViews), 'Every recorded page load'),
    metric('Avg. daily visitors', number(data.averageDailyVisitors), 'Estimated visitors per day since tracking started'),
    metric('Pages explored', number(data.pagesViewed), 'Different pages people viewed')));
  const daily = data.daily || [];
  const chart = el('section', { class: 'analytics-chart' }, el('div', { class: 'analytics-chart-heading' }, el('h2', {}, 'Traffic over time'), el('span', { class: 'muted' }, `${date(data.from)} – ${date(data.to)}`)));
  const svgNode = (tag, attrs) => { const node = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [key,value] of Object.entries(attrs)) node.setAttribute(key, String(value)); return node; };
  const svg = svgNode('svg', { viewBox: '0 0 800 190', role: 'img', 'aria-label': 'Daily page views. Exact daily figures are in the table below.' });
  const max = Math.max(1, ...daily.map(d => d.views));
  for (const y of [20,95,170]) svg.append(svgNode('line', { x1: 0, x2: 800, y1: y, y2: y, class: 'analytics-gridline' }));
  const width = 800 / Math.max(1,daily.length);
  daily.forEach((day,i) => { const height = day.views / max * 150; const rect = svgNode('rect', { x: i*width + width*.18, y:170-height, width:width*.64, height, rx:2, class:'analytics-bar' }); const title = svgNode('title',{}); title.textContent = `${day.date}: ${number(day.views)} page views, ${number(day.visitors)} estimated visitors`; rect.append(title); svg.append(rect); });
  chart.append(svg, el('div', { class: 'analytics-chart-axis' }, el('span', {}, daily[0] ? date(daily[0].date) : ''), el('span', {}, `Peak: ${number(Math.max(0,...daily.map(d=>d.views)))} views / day`), el('span', {}, daily.at(-1) ? date(daily.at(-1).date) : '')));
  chart.append(el('details', { class: 'analytics-daily' }, el('summary', {}, 'View daily figures'), el('div', { class: 'analytics-table-wrap' }, el('table', {}, el('caption', {}, 'Daily traffic in UTC'), el('thead', {}, el('tr', {}, el('th', {scope:'col'}, 'Date'), el('th', {scope:'col'}, 'Page views'), el('th', {scope:'col'}, 'Estimated visitors'))), el('tbody', {}, ...daily.map(day => el('tr', {}, el('th', {scope:'row'}, date(day.date)), el('td', {}, number(day.views)), el('td', {}, number(day.visitors)))))))));
  main.append(chart, el('div', { class: 'analytics-rankings' }, ranking('Top pages',data.pages), ranking('Traffic sources',data.sources), ranking('Devices',data.devices)),
    el('p', { class:'analytics-footnote' }, `Tracking since ${date(data.trackingStartedAt)}. Cookie-free website traffic only; podcast downloads and Substack subscribers are measured on those platforms. Visitors are estimated separately each UTC day, so one person may count on multiple days. Do Not Track, Global Privacy Control, known bots, and editor previews are excluded; blockers can also reduce counts.`));
  return main;
}
