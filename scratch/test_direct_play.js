const { app, BrowserWindow, session } = require('electron');

app.whenReady().then(async () => {
  const { Innertube } = await import('youtubei.js');
  const yt = await Innertube.create();

  // Intercept googlevideo.com requests and add VR User-Agent & strip sec-ch-ua
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://*.googlevideo.com/*'] },
    (details, callback) => {
      details.requestHeaders['User-Agent'] = 'com.google.android.apps.youtube.vr.oculus/1.37';
      delete details.requestHeaders['sec-ch-ua'];
      delete details.requestHeaders['sec-ch-ua-mobile'];
      delete details.requestHeaders['sec-ch-ua-platform'];
      callback({ requestHeaders: details.requestHeaders });
    }
  );

  const res = await yt.actions.execute('/player', { videoId: 'kXYiU_JCYtU', client: 'ANDROID_VR' });
  const formats = res.data?.streamingData?.adaptiveFormats || [];
  // Find m4a format (itag 140 is 128k AAC/m4a, itag 251 is opus)
  const m4a = formats.find(f => f.itag === 140) || formats.find(f => f.mimeType && f.mimeType.includes('audio'));
  console.log('Selected format:', m4a.itag, m4a.mimeType);
  const streamUrl = m4a.url;
  console.log('Stream URL:', streamUrl.slice(0, 100) + '...');

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      webSecurity: false
    }
  });

  win.loadURL('data:text/html,<html><body><audio id="player" controls></audio></body></html>');

  win.webContents.on('did-finish-load', async () => {
    console.log('Window loaded, playing stream directly...');
    
    const playbackTest = await win.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const audio = document.getElementById('player');
        audio.src = ${JSON.stringify(streamUrl)};
        
        audio.onplay = () => {
          console.log('Audio started playing');
        };

        audio.ontimeupdate = () => {
          if (audio.currentTime > 1) {
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
            error: audio.error ? 'Audio error code ' + audio.error.code + ': ' + audio.error.message : 'Unknown error'
          });
        };

        audio.play().catch(err => {
          resolve({ success: false, error: err.message });
        });

        setTimeout(() => {
          resolve({
            success: false,
            error: 'Timeout waiting for audio timeupdate',
            currentTime: audio.currentTime,
            readyState: audio.readyState,
            paused: audio.paused
          });
        }, 12000);
      });
    `);

    console.log('Direct playback test result:', playbackTest);
    app.quit();
  });
});
