const { app, BrowserWindow } = require('electron');

app.whenReady().then(async () => {
  const { Innertube } = await import('youtubei.js');
  const yt = await Innertube.create();

  console.log('Fetching player response via VISIONOS...');
  const res = await yt.actions.execute('/player', { videoId: 'kXYiU_JCYtU', client: 'VISIONOS' });
  const formats = res.data?.streamingData?.adaptiveFormats || [];
  const audioFormats = formats.filter(f => f.mimeType && f.mimeType.includes('audio'));
  // Sort by bitrate descending
  audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
  const bestFormat = audioFormats[0];
  console.log('Best format:', bestFormat.itag, bestFormat.mimeType, 'bitrate:', bestFormat.bitrate);
  const streamUrl = bestFormat.url;

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      webSecurity: false
    }
  });

  win.loadURL('data:text/html,<html><body><audio id="player" controls></audio></body></html>');

  win.webContents.on('did-finish-load', async () => {
    console.log('Window loaded, playing VISIONOS stream URL directly...');

    const result = await win.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const audio = document.getElementById('player');
        audio.src = ${JSON.stringify(streamUrl)};
        
        audio.onplay = () => console.log('Audio playing!');
        
        audio.ontimeupdate = () => {
          if (audio.currentTime > 3) {
            resolve({
              success: true,
              currentTime: audio.currentTime,
              duration: audio.duration,
              paused: audio.paused
            });
          }
        };

        audio.onerror = (e) => {
          resolve({
            success: false,
            error: 'Audio error ' + (audio.error ? audio.error.code + ': ' + audio.error.message : 'unknown')
          });
        };

        audio.play().catch(e => resolve({ success: false, error: e.message }));

        setTimeout(() => {
          resolve({
            success: false,
            error: 'Timeout',
            currentTime: audio.currentTime,
            readyState: audio.readyState
          });
        }, 15000);
      });
    `);

    console.log('VISIONOS DIRECT PLAYBACK RESULT:', result);
    app.quit();
  });
});
