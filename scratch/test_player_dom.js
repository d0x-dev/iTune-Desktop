const { app, BrowserWindow, session } = require('electron');

app.whenReady().then(async () => {
  const authSession = session.fromPartition('persist:google_auth');
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      session: authSession,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  console.log('Session userAgent:', authSession.getUserAgent());
  try {
    await win.loadURL('https://music.youtube.com/watch?v=ysSq218zW4E');
  } catch (e) {
    console.error('loadURL error:', e.message);
  }

  await new Promise((r) => setTimeout(r, 4000));

  const currentUrl = win.webContents.getURL();
  console.log('Current URL:', currentUrl);

  const domInfo = await win.webContents.executeJavaScript(`
    (() => {
      const v = document.querySelector('video');
      const moviePlayer = document.querySelector('#movie_player');
      const playBtn = document.querySelector('.play-pause-button, #play-button, button[aria-label="Play"]');
      return {
        title: document.title,
        hasVideo: !!v,
        videoSrc: v?.src || '',
        videoPaused: v?.paused,
        currentTime: v?.currentTime,
        duration: v?.duration,
        hasMoviePlayer: !!moviePlayer,
        hasPlayBtn: !!playBtn,
        bodySnippet: document.body.innerText.slice(0, 300)
      };
    })()
  `);
  console.log('DOM Info:', domInfo);
  app.quit();
});
