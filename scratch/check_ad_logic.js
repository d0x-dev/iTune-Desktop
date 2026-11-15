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

  await win.loadURL('https://music.youtube.com/watch?v=ysSq218zW4E');
  await new Promise((r) => setTimeout(r, 6000));

  const checkAd = await win.webContents.executeJavaScript(`
    (() => {
      const adOverlay = document.querySelector(
        '.ad-showing, .ad-interrupting, .ytp-ad-player-overlay, .ytmusic-ad-player-overlay-renderer, .ytp-ad-text, .ytp-ad-preview-container'
      );
      const videoAds = document.querySelector('.video-ads');
      const moviePlayer = document.querySelector('#movie_player');
      const isMoviePlayerAd = moviePlayer?.classList?.contains('ad-showing') || moviePlayer?.classList?.contains('ad-interrupting');
      
      return {
        adOverlayFound: !!adOverlay,
        adOverlayClass: adOverlay?.className,
        videoAdsFound: !!videoAds,
        videoAdsChildrenLength: videoAds?.children?.length,
        isMoviePlayerAd,
        moviePlayerClasses: moviePlayer?.className,
      };
    })()
  `);
  console.log('Ad check result:', checkAd);
  app.quit();
});
