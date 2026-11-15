import { app, BrowserWindow, session } from 'electron';

app.whenReady().then(async () => {
  const ses = session.fromPartition('persist:test_ytm');
  const cleanUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
  ses.setUserAgent(cleanUA);

  const win = new BrowserWindow({
    width: 800,
    height: 700,
    show: false,
    webPreferences: {
      session: ses,
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  await win.loadURL('https://music.youtube.com/', { userAgent: cleanUA });
  await new Promise(r => setTimeout(r, 4000));

  const info = await win.webContents.executeJavaScript(`
    (() => {
      const signInBtn = document.querySelector('a[href*="accounts.google.com"], yt-button-renderer a, [aria-label*="Sign in"]');
      return {
        title: document.title,
        signInHref: signInBtn ? signInBtn.href : null,
        url: window.location.href
      };
    })()
  `);

  console.log('YTM Page loaded:', JSON.stringify(info, null, 2));
  win.destroy();
  app.quit();
});
