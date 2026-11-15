const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

app.whenReady().then(async () => {
  // Wait 1s for main initialization
  console.log('App ready. Checking if main functions work...');

  // Require main.js handlers
  const fs = require('fs');
  const mainCode = fs.readFileSync(path.join(__dirname, '../electron/main.js'), 'utf-8');
  console.log('Main file length:', mainCode.length);
  
  const { Innertube } = await import('youtubei.js');
  const yt = await Innertube.create();
  console.log('Innertube created.');

  // Test VISIONOS stream extraction for Downers at Dusk
  console.log('Testing stream extraction for Downers at Dusk (dCmp56tSSmA)...');
  const res = await yt.actions.execute('/player', { videoId: 'dCmp56tSSmA', client: 'VISIONOS' });
  const formats = res.data?.streamingData?.adaptiveFormats || [];
  const audioFormats = formats.filter(f => f.mimeType && f.mimeType.includes('audio'));
  audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
  const best = audioFormats[0];
  console.log('Resolved format:', best.itag, best.mimeType, 'bitrate:', best.bitrate);
  console.log('Has URL:', !!best.url);

  // Test HTML5 audio play in hidden BrowserWindow
  const win = new BrowserWindow({ show: false, webPreferences: { webSecurity: false } });
  win.loadURL('data:text/html,<html><body><audio id="p"></audio></body></html>');
  win.webContents.on('did-finish-load', async () => {
    const playResult = await win.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const a = document.getElementById('p');
        a.src = ${JSON.stringify(best.url)};
        a.ontimeupdate = () => {
          if (a.currentTime > 2) {
            resolve({ success: true, currentTime: a.currentTime, duration: a.duration });
          }
        };
        a.onerror = (e) => resolve({ success: false, error: a.error ? a.error.code : 'unknown' });
        a.play().catch(e => resolve({ success: false, error: e.message }));
        setTimeout(() => resolve({ success: false, error: 'timeout' }), 10000);
      })
    `);
    console.log('Playback verification result:', playResult);
    app.quit();
  });
});
