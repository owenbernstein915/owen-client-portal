export function youtubeVideoId(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    const host = url.hostname.toLowerCase();
    const id = host === 'youtu.be' ? url.pathname.slice(1) : ['youtube.com','www.youtube.com','m.youtube.com'].includes(host)
      ? url.pathname === '/watch' ? url.searchParams.get('v') : /^\/(shorts|live)\//.test(url.pathname) ? url.pathname.split('/')[2] : '' : '';
    return /^[\w-]{11}$/.test(id || '') ? id : '';
  } catch { return ''; }
}

export function mergeYouTubeEpisodes(episodes, videos = []) {
  const manual = Array.isArray(episodes?.items) ? episodes.items : [];
  if (episodes?.youtube_sync === false || !videos.length) return manual;
  const overrides = new Set(manual.map(item => youtubeVideoId(item.url)).filter(Boolean));
  const added = videos.filter(video => /^[\w-]{11}$/.test(video.id) && !overrides.has(video.id)).map(video => ({
    title: String(video.title || 'New episode').slice(0,300),
    description: String(video.description || 'Watch this episode on YouTube.').slice(0,12000),
    url: `https://www.youtube.com/watch?v=${video.id}`, image: '', image_alt: '', available: true,
  }));
  const realManual = manual.filter(item => !( /^Episode \d+$/.test(item.title) && item.description === 'Your Description here' && !item.url));
  return [...added, ...realManual].slice(0,100);
}
