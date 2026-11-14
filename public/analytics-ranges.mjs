export const analyticsRanges = Object.freeze({
  '1h': { label: 'Last Hour', minutes: 60, chartMinutes: 1 },
  '24h': { label: 'Last 24 Hours', minutes: 1440, chartMinutes: 60 },
  '7d': { label: 'Last 7 Days', minutes: 10080, chartMinutes: 360 },
});

export const analyticsRefreshMs = 60000;
