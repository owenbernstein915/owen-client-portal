export function historicalAnalyticsPanel({el,history}) {
  const data=history.data, daily=data.daily||[];
  const number=n=>new Intl.NumberFormat().format(n||0);
  const date=d=>new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(d));
  const metric=(label,value,note)=>el('article',{class:'analytics-metric'},el('p',{},label),el('strong',{},value),el('small',{},note));
  const ranking=(title,rows)=>el('section',{class:'analytics-ranking'},el('h2',{},title),rows?.length ? el('ol',{},...rows.map(row=>el('li',{},el('span',{},row.label),el('strong',{},number(row.views))))) : el('p',{class:'muted'},'No data reported.'));
  const panel=el('section',{class:'analytics-history','aria-label':'Imported Netlify analytics'},
    el('div',{class:'analytics-history-heading'},el('div',{},el('p',{class:'eyebrow'},'SAVED NETLIFY REPORT'),el('h2',{},'30-day snapshot')),el('p',{class:'muted'},`${date(history.from_date)} – ${date(history.to_date)}, ${new Date(history.to_date).getUTCFullYear()} · Netlify`)),
    el('div',{class:'analytics-metrics'},metric('Page views',number(data.pageViews),'Pages served by Netlify'),metric('Unique visitors',number(data.uniqueVisitors),'Netlify’s unique visitors for this report'),metric('Bandwidth',data.bandwidth,'Total data served in this report')));
  const chart=el('section',{class:'analytics-chart'},el('div',{class:'analytics-chart-heading'},el('h2',{},'Historical page views'),el('span',{class:'muted'},'Daily totals · UTC')));
  const node=(tag,attributes)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attributes))n.setAttribute(k,String(v));return n;};
  const svg=node('svg',{viewBox:'0 0 800 190',role:'img','aria-label':'Imported daily page views. Exact figures are in the table below.'});
  const max=Math.max(1,...daily.map(d=>d.views)), width=800/Math.max(1,daily.length);
  for(const y of [20,95,170])svg.append(node('line',{x1:0,x2:800,y1:y,y2:y,class:'analytics-gridline'}));
  daily.forEach((day,i)=>{const height=day.views/max*150;const bar=node('rect',{x:i*width+width*.18,y:170-height,width:width*.64,height,rx:2,class:'analytics-bar'});const title=node('title',{});title.textContent=`${day.date}: ${number(day.views)} page views, ${number(day.visitors)} daily unique visitors`;bar.append(title);svg.append(bar);});
  chart.append(svg,el('div',{class:'analytics-chart-axis'},el('span',{},daily.length?date(daily[0].date):''),el('span',{},`Peak: ${number(Math.max(0,...daily.map(d=>d.views)))} views / day`),el('span',{},daily.length?date(daily.at(-1).date):'')));
  chart.append(el('details',{class:'analytics-daily'},el('summary',{},'View imported daily figures'),el('div',{class:'analytics-table-wrap'},el('table',{},el('caption',{},'Netlify daily traffic in UTC'),el('thead',{},el('tr',{},el('th',{scope:'col'},'Date'),el('th',{scope:'col'},'Page views'),el('th',{scope:'col'},'Daily unique visitors'))),el('tbody',{},...daily.map(day=>el('tr',{},el('th',{scope:'row'},date(day.date)),el('td',{},number(day.views)),el('td',{},number(day.visitors)))))))));
  panel.append(chart,el('details',{class:'analytics-history-details'},el('summary',{},'Top pages, sources and locations'),el('div',{class:'analytics-rankings'},ranking('Top pages',data.pages),ranking('Traffic sources',data.sources),ranking('Locations',data.locations))),
    el('p',{class:'analytics-footnote'},`Imported ${date(history.imported_at)} from Netlify’s 30-day report. ${data.coverageLabel || ''} The last day is partial. This saved report does not change with the live tracking range. It is never added to the live totals above. Netlify counts can include automated traffic. Daily unique visitors cannot be summed into period-wide unique visitors.`));
  return panel;
}
