const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const { Innertube } = await import('youtubei.js');
  
  // 1. Authenticated client (simulating user session)
  const sessionPath = path.join(process.env.APPDATA, 'itune-desktop', 'itune_session.json');
  let cookie = '';
  if (fs.existsSync(sessionPath)) {
    cookie = JSON.parse(fs.readFileSync(sessionPath, 'utf8')).cookie || '';
  }
  console.log('User cookie loaded. Length:', cookie.length);
  const ytAuth = await Innertube.create({ cookie: cookie || undefined });

  // 2. Unauthenticated stream extractor (matching AirBeats architecture)
  const streamYt = await Innertube.create({ generate_session_locally: true });

  const videoId = '48ydDUQ16RE'; // Without Me (feat. Juice WRLD)
  console.log('Resolving stream for videoId:', videoId);

  let streamUrl = null;
  const clients = ['VISIONOS', 'IOS', 'ANDROID_VR'];
  for (const client of clients) {
    try {
      const res = await streamYt.actions.execute('/player', { videoId, client });
      if (res.data?.playabilityStatus?.status !== 'OK') {
        console.log(`Client ${client} status not OK:`, res.data?.playabilityStatus?.status);
        continue;
      }
      const formats = res.data?.streamingData?.adaptiveFormats || [];
      const audioFormats = formats.filter(f => f.mimeType && f.mimeType.includes('audio'));
      if (audioFormats.length > 0) {
        audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
        const best = audioFormats[0];
        if (best.url) {
          console.log(`Resolved stream via ${client}:`, best.mimeType, 'bitrate:', best.bitrate);
          streamUrl = best.url;
          break;
        }
      }
    } catch (e) {
      console.log(`Client ${client} failed:`, e.message);
    }
  }

  if (!streamUrl) {
    console.error('FAILED TO RESOLVE STREAM URL!');
    app.quit();
    return;
  }

  console.log('Stream URL resolved successfully:', streamUrl.slice(0, 100) + '...');

  // Test HTML5 playback
  const win = new BrowserWindow({ show: false, webPreferences: { webSecurity: false } });
  win.loadURL('data:text/html,<html><body><audio id="player"></audio></body></html>');
  win.webContents.on('did-finish-load', async () => {
    const playResult = await win.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const audio = document.getElementById('player');
        audio.src = ${JSON.stringify(streamUrl)};
        audio.ontimeupdate = () => {
          if (audio.currentTime > 2) {
            resolve({ success: true, currentTime: audio.currentTime, duration: audio.duration });
          }
        };
        audio.onerror = (e) => {
          resolve({ success: false, error: audio.error ? 'Code ' + audio.error.code + ': ' + audio.error.message : 'Unknown' });
        };
        audio.play().catch(e => resolve({ success: false, error: e.message }));
        setTimeout(() => {
          resolve({ success: false, error: 'Timeout waiting for audio timeupdate', readyState: audio.readyState, currentTime: audio.currentTime });
        }, 12000);
      });
    `);
    console.log('PLAYBACK RESULT:', playResult);
    app.quit();
  });
});
