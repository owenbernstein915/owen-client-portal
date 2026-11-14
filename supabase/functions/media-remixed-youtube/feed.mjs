export const CHANNEL_ID = 'UCRwSusbawKh_BrA1Nmw2atQ';
export const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
function decode(value) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity,key) => {
    const symbols={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
    if (symbols[key]) return symbols[key];
    const number=key.startsWith('#x') ? parseInt(key.slice(2),16) : Number(key.slice(1));
    return number>0 && number<=0x10ffff ? String.fromCodePoint(number) : '';
  }).trim();
}
const tag=(text,name)=>decode(text.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`))?.[1]||'');
const isChannel=id=>id===CHANNEL_ID || id===CHANNEL_ID.slice(2);
export function parseFeed(xml) {
  if (xml.length>600000 || /<!DOCTYPE|<!ENTITY/i.test(xml) || !xml.includes('<feed') || !isChannel(tag(xml,'yt:channelId'))) throw new Error('Invalid channel feed');
  const videos=[];
  for(const match of xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/g)) {
    const entry=match[1], id=tag(entry,'yt:videoId'), published=tag(entry,'published');
    if(!/^[\w-]{11}$/.test(id)||!isChannel(tag(entry,'yt:channelId'))||!Number.isFinite(Date.parse(published))) continue;
    videos.push({id,title:tag(entry,'title').slice(0,300),description:tag(entry,'media:description').slice(0,12000),published:new Date(published).toISOString()});
  }
  return videos;
}
export function mergeArchive(previous, latest) {
  const videos = new Map(previous.map(video=>[video.id,video]));
  for(const video of latest) videos.set(video.id,video);
  return [...videos.values()].sort((a,b)=>b.published.localeCompare(a.published)).slice(0,500);
}
