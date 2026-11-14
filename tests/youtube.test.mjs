import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFeed,mergeArchive,CHANNEL_ID} from '../supabase/functions/media-remixed-youtube/feed.mjs';
import {youtubeVideoId,mergeYouTubeEpisodes} from '../public/media-episodes.mjs';
const video={id:'abcdefghijk',title:'First & next',description:'Full episode',published:'2026-11-14T12:00:00.000Z'};
const feed=`<feed><yt:channelId>${CHANNEL_ID.slice(2)}</yt:channelId><entry><yt:videoId>${video.id}</yt:videoId><yt:channelId>${CHANNEL_ID}</yt:channelId><title>First &amp; next</title><published>${video.published}</published><media:description>Full episode</media:description></entry></feed>`;
test('YouTube feed parser accepts the channel’s feed ID, decodes text, and rejects foreign or malformed feeds',()=>{
 assert.deepEqual(parseFeed(feed),[video]);
 assert.deepEqual(parseFeed(`<feed><yt:channelId>${CHANNEL_ID.slice(2)}</yt:channelId></feed>`),[]);
 assert.throws(()=>parseFeed(feed.replaceAll(CHANNEL_ID.slice(2),'foreign')));
 assert.throws(()=>parseFeed('<!DOCTYPE x>'+feed));
 assert.deepEqual(parseFeed(feed.replace(video.id,'not-a-video-id')),[]);
});
test('Archive retains older uploads and replaces updated titles without duplicating videos',()=>{
 const older={...video,id:'lmnopqrstuv',published:'2026-11-01T00:00:00.000Z'};
 assert.deepEqual(mergeArchive([older,video],[{...video,title:'Updated'}]),[{...video,title:'Updated'},older]);
});
test('Automatic episodes preserve text overrides and hidden episodes, deduplicate videos, and remove only untouched placeholders',()=>{
 const override={title:'Custom title',description:'Custom description',url:`https://youtu.be/${video.id}`,available:false,image:''};
 const placeholder={title:'Episode 01',description:'Your Description here',url:''};
 const manual={title:'Special',description:'Manual episode',url:'https://example.com/episode',available:true};
 const next={...video,id:'lmnopqrstuv'};
 const items=mergeYouTubeEpisodes({items:[override,placeholder,manual]},[next,video]);
 assert.equal(items.length,3);assert.equal(items[0].url,'https://www.youtube.com/watch?v=lmnopqrstuv');assert.deepEqual(items[1],override);assert.deepEqual(items[2],manual);
 assert.deepEqual(mergeYouTubeEpisodes({youtube_sync:false,items:[placeholder]},[video]),[placeholder]);
 assert.deepEqual(mergeYouTubeEpisodes({items:[placeholder]},[]),[placeholder]);
});
test('Only valid HTTPS YouTube URLs identify videos',()=>{
 assert.equal(youtubeVideoId('https://www.youtube.com/watch?v=abcdefghijk'),'abcdefghijk');
 assert.equal(youtubeVideoId('https://youtube.com/shorts/abcdefghijk'),'abcdefghijk');
 for(const url of ['https://youtube.com.evil.test/watch?v=abcdefghijk','javascript:alert(1)','https://x:secret@youtube.com/watch?v=abcdefghijk','https://youtu.be/no'])assert.equal(youtubeVideoId(url),'');
});
