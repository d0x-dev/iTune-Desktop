const { app, BrowserWindow, session } = require('electron');

app.whenReady().then(async () => {
  const { Innertube } = await import('youtubei.js');
  const yt = await Innertube.create();

  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://*.googlevideo.com/*'] },
    (details, callback) => {
      details.requestHeaders['User-Agent'] = 'com.google.android.apps.youtube.vr.oculus/1.37';
      delete details.requestHeaders['sec-ch-ua'];
      delete details.requestHeaders['sec-ch-ua-mobile'];
      delete details.requestHeaders['sec-ch-ua-platform'];
      console.log('Sending headers:', details.requestHeaders);
      callback({ requestHeaders: details.requestHeaders });
    }
  );

  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['https://*.googlevideo.com/*'] },
    (details, callback) => {
      console.log('Received response statusLine:', details.statusLine);
      console.log('Response headers:', details.responseHeaders);
      callback({ responseHeaders: details.responseHeaders });
    }
  );

  const res = await yt.actions.execute('/player', { videoId: 'kXYiU_JCYtU', client: 'ANDROID_VR' });
  const formats = res.data?.streamingData?.adaptiveFormats || [];
  const m4a = formats.find(f => f.itag === 140) || formats.find(f => f.mimeType && f.mimeType.includes('audio'));
  const streamUrl = m4a.url;

  const win = new BrowserWindow({ show: false });
  win.loadURL('data:text/html,<html><body><audio id="player" controls></audio></body></html>');
  win.webContents.on('did-finish-load', async () => {
    await win.webContents.executeJavaScript(`
      const audio = document.getElementById('player');
      audio.src = ${JSON.stringify(streamUrl)};
      audio.play().catch(e => console.error(e));
    `);
    setTimeout(() => { app.quit(); }, 4000);
  });
});
