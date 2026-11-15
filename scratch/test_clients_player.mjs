import { Innertube } from 'youtubei.js';
import fs from 'fs';
import path from 'path';

(async () => {
  const sessionPath = path.join(process.env.APPDATA, 'itune-desktop', 'itune_session.json');
  const { cookie } = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));

  const yt = await Innertube.create({ cookie });

  // Test 1: iOS client player request (exact client AirBeats uses)
  console.log('--- Testing IOS client ---');
  try {
    const res = await yt.actions.execute('/player', {
      videoId: 'ysSq218zW4E',
      client: 'IOS',
    });
    console.log('iOS status:', res.status_code, 'playability:', res.data?.playabilityStatus?.status);
    const formats = res.data?.streamingData?.adaptiveFormats?.filter(f => f.mimeType?.includes('audio')) || [];
    console.log('iOS audio formats count:', formats.length);
    for (const f of formats) {
      console.log('  itag:', f.itag, 'mime:', f.mimeType, 'bitrate:', f.bitrate, 'has url:', !!f.url, 'url starts with:', f.url?.slice(0, 60));
    }
  } catch (e) {
    console.log('iOS error:', e.message);
  }

  // Test 2: TV client player request
  console.log('\n--- Testing TV client ---');
  try {
    const res = await yt.actions.execute('/player', {
      videoId: 'ysSq218zW4E',
      client: 'TV',
    });
    console.log('TV status:', res.status_code, 'playability:', res.data?.playabilityStatus?.status);
    const formats = res.data?.streamingData?.adaptiveFormats?.filter(f => f.mimeType?.includes('audio')) || [];
    console.log('TV audio formats count:', formats.length);
    for (const f of formats) {
      console.log('  itag:', f.itag, 'mime:', f.mimeType, 'bitrate:', f.bitrate, 'has url:', !!f.url, 'url starts with:', f.url?.slice(0, 60));
    }
  } catch (e) {
    console.log('TV error:', e.message);
  }

  // Test 3: ANDROID client player request
  console.log('\n--- Testing ANDROID client ---');
  try {
    const res = await yt.actions.execute('/player', {
      videoId: 'ysSq218zW4E',
      client: 'ANDROID',
    });
    console.log('ANDROID status:', res.status_code, 'playability:', res.data?.playabilityStatus?.status);
    const formats = res.data?.streamingData?.adaptiveFormats?.filter(f => f.mimeType?.includes('audio')) || [];
    console.log('ANDROID audio formats count:', formats.length);
    for (const f of formats) {
      console.log('  itag:', f.itag, 'mime:', f.mimeType, 'bitrate:', f.bitrate, 'has url:', !!f.url, 'url starts with:', f.url?.slice(0, 60));
    }
  } catch (e) {
    console.log('ANDROID error:', e.message);
  }

  // Test 4: YTMUSIC client player request
  console.log('\n--- Testing YTMUSIC client ---');
  try {
    const res = await yt.actions.execute('/player', {
      videoId: 'ysSq218zW4E',
      client: 'YTMUSIC',
    });
    console.log('YTMUSIC status:', res.status_code, 'playability:', res.data?.playabilityStatus?.status);
    const formats = res.data?.streamingData?.adaptiveFormats?.filter(f => f.mimeType?.includes('audio')) || [];
    console.log('YTMUSIC audio formats count:', formats.length);
    for (const f of formats) {
      console.log('  itag:', f.itag, 'mime:', f.mimeType, 'bitrate:', f.bitrate, 'has url:', !!f.url, 'url starts with:', f.url?.slice(0, 60));
    }
  } catch (e) {
    console.log('YTMUSIC error:', e.message);
  }
})();
