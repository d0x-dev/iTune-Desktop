const { app, BrowserWindow } = require('electron');

app.whenReady().then(async () => {
  const { Innertube } = await import('youtubei.js');
  const streamClient = await Innertube.create(); // Valid server session & visitorData!

  const videoId = '48ydDUQ16RE';
  console.log('Resolving stream for Without Me using streamClient...');
  const res = await streamClient.actions.execute('/player', { videoId, client: 'VISIONOS' });
  const formats = res.data?.streamingData?.adaptiveFormats?.filter(f => f.mimeType?.includes('audio')) || [];
  formats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
  const best = formats[0];
  console.log('Best format:', best.itag, best.mimeType, 'bitrate:', best.bitrate);
  console.log('URL:', best.url.slice(0, 100) + '...');

  const win = new BrowserWindow({ show: false, webPreferences: { webSecurity: false } });
  win.loadURL('data:text/html,<html><body><audio id="player" controls></audio></body></html>');
  win.webContents.on('did-finish-load', async () => {
    const playResult = await win.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const audio = document.getElementById('player');
        audio.src = ${JSON.stringify(best.url)};
        audio.onplay = () => console.log('Audio playing!');
        audio.ontimeupdate = () => {
          if (audio.currentTime > 2) {
            resolve({ success: true, currentTime: audio.currentTime, duration: audio.duration });
          }
        };
        audio.onerror = () => {
          resolve({ success: false, error: audio.error ? 'Code ' + audio.error.code : 'unknown' });
        };
        audio.play().catch(e => resolve({ success: false, error: e.message }));
        setTimeout(() => {
          resolve({ success: false, error: 'timeout', currentTime: audio.currentTime, readyState: audio.readyState });
        }, 12000);
      });
    `);
    console.log('PLAYBACK TEST RESULT:', playResult);
    app.quit();
  });
});
