const { app, BrowserWindow, session, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let playerWindow = null;
let playerMonitorInterval = null;
let activeTrackId = null;
let activeTrackTitle = null;

function logToFile(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

function getOrCreatePlayerWindow() {
  if (playerWindow && !playerWindow.isDestroyed()) {
    return playerWindow;
  }

  const authSession = session.fromPartition('persist:google_auth');

  // Load saved cookies to authSession
  const sessionPath = path.join(process.env.APPDATA, 'itune-desktop', 'itune_session.json');
  if (fs.existsSync(sessionPath)) {
    const data = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
    if (data.cookie) {
      const pairs = data.cookie.split(';');
      for (const pair of pairs) {
        const idx = pair.indexOf('=');
        if (idx === -1) continue;
        const name = pair.slice(0, idx).trim();
        const value = pair.slice(idx + 1).trim();
        if (name && value) {
          authSession.cookies.set({
            url: 'https://music.youtube.com',
            domain: '.youtube.com',
            name,
            value,
            path: '/',
            secure: true,
          }).catch(() => {});
        }
      }
    }
  }

  playerWindow = new BrowserWindow({
    width: 600,
    height: 400,
    show: false,
    webPreferences: {
      session: authSession,
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  playerWindow.webContents.setAudioMuted(false);
  return playerWindow;
}

app.whenReady().then(async () => {
  const win = getOrCreatePlayerWindow();
  console.log('Player window created. Loading track...');
  
  const videoId = 'ysSq218zW4E';
  const watchUrl = `https://music.youtube.com/watch?v=${videoId}`;
  await win.loadURL(watchUrl);
  console.log('Page loaded URL:', watchUrl);

  // Monitor for 12 seconds
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const state = await win.webContents.executeJavaScript(`
        (() => {
          const v = document.querySelector('video');
          const moviePlayer = document.querySelector('#movie_player');
          const adOverlay = document.querySelector(
            '.ad-showing, .ad-interrupting, .ytp-ad-player-overlay, .ytmusic-ad-player-overlay-renderer, .ytp-ad-text, .ytp-ad-preview-container'
          );
          const isAd = !!adOverlay || (document.querySelector('.video-ads')?.children?.length > 0);
          
          return {
            hasVideo: !!v,
            paused: v?.paused,
            currentTime: v?.currentTime,
            duration: v?.duration,
            volume: v?.volume,
            muted: v?.muted,
            readyState: v?.readyState,
            isAd,
            videoSrc: v?.src?.slice(0, 50),
            title: document.querySelector('ytmusic-player-bar .title')?.textContent?.trim(),
            moviePlayerClasses: moviePlayer?.className,
          };
        })()
      `);
      console.log(`[+${(i * 0.5).toFixed(1)}s]`, state);
    } catch (e) {
      console.log(`[+${(i * 0.5).toFixed(1)}s] execute error:`, e.message);
    }
  }

  app.quit();
});
