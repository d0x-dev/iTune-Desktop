const { app, BrowserWindow, ipcMain, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const vm = require('vm');
let innertubeModule = null;
async function getInnertube() {
  if (!innertubeModule) {
    innertubeModule = await import('youtubei.js');
  }
  return innertubeModule;
}

app.setName('itune-desktop');
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');

let mainWindow = null;
let authWindow = null;
let yt = null;
let initPromise = null;
let loginResolver = null;

let userProfile = {
  name: null,
  email: null,
  photo: null,
  isLoggedIn: false,
};

// Logger to file for troubleshooting
function logToFile(...args) {
  const msg = `[${new Date().toISOString()}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`;
  console.log(...args);
  try {
    const logPath = path.join(process.env.APPDATA || '', 'itune-desktop', 'app.log');
    fs.appendFileSync(logPath, msg);
  } catch (e) {}
}

// Sanitize and deduplicate cookie string (giving priority to YouTube cookies over Google cookies)
function sanitizeAndDeduplicateCookie(rawCookie) {
  if (!rawCookie || typeof rawCookie !== 'string') return '';
  const pairs = rawCookie.split(';');
  const map = new Map();
  for (const p of pairs) {
    const trimmed = p.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim();
    if (k) map.set(k, v);
  }
  return Array.from(map.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

// Check multiple locations for saved session cookies
function getSessionPaths() {
  const appData = process.env.APPDATA || '';
  return [
    path.join(appData, 'itune-desktop', 'itune_session.json'),
    path.join(appData, 'iTune Desktop', 'itune_session.json'),
    path.join(app.getPath('userData'), 'itune_session.json'),
  ];
}

function loadSavedCookie() {
  try {
    for (const sessionFile of getSessionPaths()) {
      if (fs.existsSync(sessionFile)) {
        const data = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
        if (data.cookie && data.cookie.trim()) {
          const cleaned = sanitizeAndDeduplicateCookie(data.cookie.trim());
          logToFile('Loaded and sanitized session cookie from:', sessionFile);
          return cleaned;
        }
      }
    }
  } catch (err) {
    logToFile('Failed to load saved session cookie:', err);
  }
  return '';
}

function saveCookie(cookieStr) {
  try {
    const cleaned = sanitizeAndDeduplicateCookie(cookieStr);
    const payload = JSON.stringify({ cookie: cleaned, savedAt: Date.now() });
    for (const sessionFile of getSessionPaths()) {
      try {
        fs.mkdirSync(path.dirname(sessionFile), { recursive: true });
        fs.writeFileSync(sessionFile, payload, 'utf-8');
        logToFile('Saved sanitized session cookie to:', sessionFile);
      } catch (e) {}
    }
  } catch (err) {
    logToFile('Failed to save session cookie:', err);
  }
}

function clearSavedCookie() {
  try {
    for (const sessionFile of getSessionPaths()) {
      if (fs.existsSync(sessionFile)) {
        fs.unlinkSync(sessionFile);
      }
    }
    logToFile('Cleared active session cookies.');
  } catch (err) {
    logToFile('Failed to delete session cookie:', err);
  }
}

async function syncCookiesToSession(cookieStr) {
  if (!cookieStr || !cookieStr.trim()) return;
  try {
    const authSession = session.fromPartition('persist:google_auth');
    const pairs = cookieStr.split(';');
    for (const pair of pairs) {
      const idx = pair.indexOf('=');
      if (idx === -1) continue;
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (!name || !value) continue;
      try {
        await authSession.cookies.set({
          url: 'https://music.youtube.com',
          domain: '.youtube.com',
          name,
          value,
          path: '/',
          secure: true,
          httpOnly:
            name.toLowerCase().includes('sapisid') ||
            name.toLowerCase().includes('ssid') ||
            name.startsWith('__Secure'),
        });
      } catch (e) {}
    }
    logToFile('Synced session cookies to Chromium persist:google_auth partition.');
  } catch (err) {
    logToFile('Error syncing cookies to partition:', err.message);
  }
}

let streamClient = null;
let streamInitPromise = null;
async function getStreamClient() {
  if (streamClient) return streamClient;
  if (!streamInitPromise) {
    streamInitPromise = (async () => {
      try {
        const { Innertube, Platform } = await getInnertube();
        if (Platform?.shim) {
          Platform.shim.eval = (data, env) => {
            const code = typeof data === 'object' && data.output ? data.output : data;
            return vm.runInNewContext(code, env || {});
          };
        }
        // Dedicated guest Innertube instance without user cookies:
        // YouTube stream endpoints (VISIONOS, ANDROID_VR, IOS) return HTTP 400 if user web cookies are attached.
        // A clean guest session provides authentic visitorData and returns unenciphered stream URLs.
        streamClient = await Innertube.create();
        logToFile('Dedicated stream extractor Innertube initialized with clean visitorData.');
        return streamClient;
      } catch (err) {
        logToFile('Failed to initialize stream extractor Innertube:', err.message);
        streamInitPromise = null;
        throw err;
      }
    })();
  }
  return streamInitPromise;
}

// Initialize YouTube.js client
function initYouTube(cookie = '') {
  initPromise = (async () => {
    try {
      const cleanCookie = sanitizeAndDeduplicateCookie(cookie);
      logToFile('Initializing Innertube with cookie length:', cleanCookie ? cleanCookie.length : 0);
      if (cleanCookie) {
        syncCookiesToSession(cleanCookie).catch(() => {});
      }
      const { Innertube, UniversalCache, Platform } = await getInnertube();
      if (Platform?.shim) {
        Platform.shim.eval = (data, env) => {
          const code = typeof data === 'object' && data.output ? data.output : data;
          return vm.runInNewContext(code, env || {});
        };
      }

      const cacheDir = path.join(process.env.APPDATA || app.getPath('userData'), 'itune-desktop', 'yt_cache');
      let cache = null;
      try {
        fs.mkdirSync(cacheDir, { recursive: true });
        cache = new UniversalCache(true, cacheDir);
      } catch (e) {
        logToFile('Falling back to memory cache:', e.message);
        cache = new UniversalCache(false);
      }

      yt = await Innertube.create({
        cache: cache,
        cookie: cleanCookie || undefined,
        generate_session_locally: true,
      });

      if (cleanCookie) {
        let parsedProfile = null;

        // Method 1: YouTube Music account_menu (matches AirBeats InnerTube)
        try {
          const res = await yt.actions.execute('/account/account_menu', { client: 'YTMUSIC' });
          const header =
            res?.data?.actions?.[0]?.openPopupAction?.popup?.multiPageMenuRenderer?.header
              ?.activeAccountHeaderRenderer;
          if (header) {
            const name =
              header.accountName?.runs?.[0]?.text ||
              header.accountName?.simpleText ||
              '';
            const email =
              header.channelHandle?.runs?.[0]?.text ||
              header.email?.runs?.[0]?.text ||
              header.email?.simpleText ||
              '';
            const thumbs = header.accountPhoto?.thumbnails || [];
            const photo = thumbs.length > 0 ? thumbs[thumbs.length - 1]?.url : null;

            if (name) {
              parsedProfile = {
                name,
                email,
                photo,
                isLoggedIn: true,
              };
              logToFile('Parsed profile via account_menu:', name, email);
            }
          }
        } catch (e) {
          logToFile('account_menu check error:', e.message);
        }

        // Method 2: yt.account.getInfo() fallback
        if (!parsedProfile) {
          try {
            const info = await yt.account.getInfo();
            const accountItem = info?.contents?.contents?.[0];
            const name = accountItem?.account_name?.text || info?.name || '';
            const email = accountItem?.account_byline?.text || info?.email || '';
            const photo = accountItem?.account_photo?.[0]?.url || info?.photo?.[0]?.url || null;
            if (name) {
              parsedProfile = {
                name,
                email,
                photo,
                isLoggedIn: true,
              };
              logToFile('Parsed profile via getInfo:', name);
            }
          } catch (e) {
            logToFile('yt.account.getInfo fallback error:', e.message);
          }
        }

        userProfile = parsedProfile || {
          name: 'YouTube User',
          email: '',
          photo: null,
          isLoggedIn: true,
        };
      } else {
        userProfile = {
          name: null,
          email: null,
          photo: null,
          isLoggedIn: false,
        };
      }

      logToFile('Innertube initialized. Logged in:', userProfile.isLoggedIn, 'User:', userProfile.name);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('auth:changed', userProfile);
      }
      return userProfile;
    } catch (err) {
      logToFile('Error initializing Innertube:', err);
      return userProfile;
    }
  })();

  return initPromise;
}

// Helper to extract artist names reliably
function parseArtistsFromItem(item) {
  if (item.artists && Array.isArray(item.artists) && item.artists.length > 0) {
    const list = item.artists
      .map((a) => ({ name: (a.name || a.toString() || '').trim(), id: a.channel_id || a.id }))
      .filter((a) => a.name && a.name !== 'Unknown Artist');
    if (list.length > 0) return list;
  }
  if (item.author) {
    const authName = (typeof item.author === 'object' ? item.author.name : item.author || '').trim();
    if (authName && authName !== 'Unknown Artist') {
      return [{ name: authName }];
    }
  }
  const subText = (item.subtitle?.text || item.subtitle?.toString() || item.subtitle || '').trim();
  if (subText) {
    const parts = subText.split('•').map((p) => p.trim());
    if (parts.length >= 2) {
      const first = parts[0].toLowerCase();
      if (['song', 'video', 'track', 'album', 'single', 'ep'].includes(first)) {
        return [{ name: parts[1] }];
      }
      return [{ name: parts[0] }];
    } else if (parts.length === 1 && parts[0]) {
      return [{ name: parts[0] }];
    }
  }
  return [{ name: 'YouTube Music' }];
}

function getThumbnailUrl(item) {
  if (!item) return null;
  if (typeof item === 'string' && item.startsWith('http')) return item;
  const list =
    (Array.isArray(item) ? item : null) ||
    item.thumbnails ||
    item.thumbnail?.contents ||
    item.thumbnail?.thumbnails ||
    (Array.isArray(item.thumbnail) ? item.thumbnail : null) ||
    [];
  if (Array.isArray(list) && list.length > 0) {
    return list[list.length - 1]?.url || list[0]?.url || null;
  }
  return null;
}

function normalizeSearchTrack(item) {
  if (!item) return null;
  const id =
    item.id ||
    item.videoId ||
    item.endpoint?.payload?.videoId ||
    item.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;

  const title =
    item.title?.text ||
    item.title?.toString() ||
    (typeof item.title === 'string' ? item.title : '') ||
    item.name ||
    '';

  if (!id || !title) return null;

  const artists = parseArtistsFromItem(item);
  const albumName = item.album?.name || item.album?.title || (typeof item.album === 'string' ? item.album : null);
  const albumId = item.album?.id;

  let durationText = '';
  let durationSeconds = null;
  if (typeof item.duration === 'string') {
    durationText = item.duration;
  } else if (item.duration?.text) {
    durationText = item.duration.text;
    durationSeconds = item.duration.seconds || null;
  } else if (item.duration?.seconds) {
    durationSeconds = item.duration.seconds;
    const m = Math.floor(durationSeconds / 60);
    const s = (durationSeconds % 60).toString().padStart(2, '0');
    durationText = `${m}:${s}`;
  }

  const thumbnail = getThumbnailUrl(item) || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

  return {
    id,
    title,
    artists: artists.length > 0 ? artists : [{ name: 'YouTube Music' }],
    album: albumName ? { name: albumName, id: albumId } : null,
    duration: durationText,
    durationSeconds,
    thumbnail,
    type: item.type || 'track',
  };
}

function parseResponsiveListItem(row) {
  if (!row) return null;
  const flex = row.flexColumns || [];
  const col0 = flex[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
  const col1 = flex[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
  const col2 = flex[2]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];

  const title = col0.map((r) => r.text).join('').trim();
  const artistRuns = col1.filter(
    (r) => r.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('UC') || !r.text.includes('•')
  );
  const artistName =
    artistRuns.map((r) => r.text).join('').trim() ||
    col1.map((r) => r.text).join('').trim();
  const albumName = col2.map((r) => r.text).join('').trim();

  const fixed = row.fixedColumns || [];
  const duration =
    fixed[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.runs?.map((r) => r.text).join('').trim() || '';

  const thumbs = row.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
  const thumbnail = thumbs[thumbs.length - 1]?.url || thumbs[0]?.url || null;

  const videoId =
    row.playlistItemData?.videoId ||
    row.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId ||
    col0[0]?.navigationEndpoint?.watchEndpoint?.videoId ||
    row.navigationEndpoint?.watchEndpoint?.videoId;

  if (!videoId || !title) return null;

  return {
    id: videoId,
    title,
    artists: [{ name: artistName || 'YouTube Music' }],
    album: albumName ? { name: albumName } : null,
    duration,
    thumbnail: thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };
}

function extractTracksFromBrowseData(data) {
  const tracks = [];
  const seen = new Set();

  function scan(node) {
    if (!node || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      for (const item of node) scan(item);
      return;
    }

    if (node.musicResponsiveListItemRenderer) {
      const t = parseResponsiveListItem(node.musicResponsiveListItemRenderer);
      if (t && !seen.has(t.id)) {
        seen.add(t.id);
        tracks.push(t);
      }
      return;
    }

    for (const key of Object.keys(node)) {
      if (
        key === 'trackingParams' ||
        key === 'frameworkUpdates' ||
        key === 'responseContext' ||
        key === 'clickTrackingParams' ||
        key === 'serviceTrackingParams'
      ) {
        continue;
      }
      scan(node[key]);
    }
  }

  scan(data);
  return tracks;
}

function extractTracksFromSearch(searchRes) {
  const items = [];
  const rawSections = searchRes.results || searchRes.contents || [];

  for (const section of rawSections) {
    if (!section) continue;

    // Case 1: MusicCardShelf (Top Result)
    if (section.type === 'MusicCardShelf') {
      const topTitle = section.title?.text || section.title?.toString() || '';
      const topSubtitle = section.subtitle?.text || section.subtitle?.toString() || '';
      const artists = parseArtistsFromItem(section);
      const videoId =
        section.id ||
        section.endpoint?.payload?.videoId ||
        section.on_tap?.payload?.videoId ||
        section.buttons?.find((b) => b.endpoint?.payload?.videoId)?.endpoint?.payload?.videoId;
      const albumId =
        section.endpoint?.payload?.playlistId ||
        section.buttons?.find((b) => b.endpoint?.payload?.playlistId)?.endpoint?.payload?.playlistId;

      if (videoId && topTitle) {
        items.push({
          id: videoId,
          title: topTitle,
          artists: artists.length > 0 ? artists : [{ name: topSubtitle.split('•')[0]?.trim() || 'YouTube Music' }],
          album: albumId ? { name: topTitle, id: albumId } : null,
          duration: '',
          durationSeconds: null,
          thumbnail: getThumbnailUrl(section) || null,
          type: 'top_result',
        });
      }

      if (Array.isArray(section.contents)) {
        for (const subItem of section.contents) {
          const track = normalizeSearchTrack(subItem);
          if (track) items.push(track);
        }
      }
    }

    // Case 2: ItemSection or MusicShelf
    const sectionItems = section.contents || section.items || [];
    if (Array.isArray(sectionItems) && sectionItems.length > 0) {
      for (const item of sectionItems) {
        const track = normalizeSearchTrack(item);
        if (track) items.push(track);
      }
    }

    // Case 3: Direct item
    if (section.type === 'MusicResponsiveListItem' || section.id || section.videoId) {
      const track = normalizeSearchTrack(section);
      if (track) items.push(track);
    }
  }

  const seen = new Set();
  return items.filter((track) => {
    if (!track.id || seen.has(track.id)) return false;
    seen.add(track.id);
    return true;
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0a0a0c',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0a0c',
      symbolColor: '#ffffff',
      height: 38,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}





// In-App Google Login Browser Popup Window
function openGoogleLogin() {
  return new Promise((resolve) => {
    let isCompleted = false;
    loginResolver = resolve;

    if (authWindow && !authWindow.isDestroyed()) {
      authWindow.focus();
      return;
    }

    const authSession = session.fromPartition('persist:google_auth');

    // Genuine Mobile Android User-Agent: Proven to bypass Google's "This browser or app may not be secure" block in Electron
    const mobileUA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.137 Mobile Safari/537.36';
    authSession.setUserAgent(mobileUA);

    authWindow = new BrowserWindow({
      width: 480,
      height: 720,
      title: 'Sign In - YouTube Music',
      parent: mainWindow,
      modal: false,
      autoHideMenuBar: true,
      backgroundColor: '#ffffff',
      webPreferences: {
        session: authSession,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    authWindow.setMenuBarVisibility(false);
    authWindow.webContents.setUserAgent(mobileUA);
    authWindow.webContents.on('did-create-window', (child) => {
      child.webContents.setUserAgent(mobileUA);
    });

    // YouTube Music Login entrypoint
    const loginUrl = 'https://accounts.google.com/ServiceLogin?service=youtube&passive=true&continue=https%3A%2F%2Fmusic.youtube.com%2F';
    authWindow.loadURL(loginUrl, { userAgent: mobileUA });

    let checkInterval = null;
    let authSettleTimer = null;

    const checkCookies = async () => {
      if (!authWindow || authWindow.isDestroyed() || isCompleted) return;
      try {
        const currentUrl = authWindow.webContents.getURL() || '';

        // CRITICAL FIX: Only capture once the user has finished Google auth and redirected to music.youtube.com!
        // Never close or capture while still on accounts.google.com!
        if (!currentUrl.includes('music.youtube.com') || currentUrl.includes('accounts.google.com')) {
          return;
        }

        const cookies = await authSession.cookies.get({});
        const ytCookies = cookies.filter((c) => c.domain && c.domain.includes('youtube.com'));
        const googleCookies = cookies.filter(
          (c) => c.domain && c.domain.includes('google.com') && !c.domain.includes('youtube.com')
        );

        // Put google cookies first, then overwrite with youtube cookies to ensure YouTube's SAPISID wins!
        const cookieMap = new Map();
        for (const c of googleCookies) {
          if (c.name && c.value) cookieMap.set(c.name, c.value);
        }
        for (const c of ytCookies) {
          if (c.name && c.value) cookieMap.set(c.name, c.value);
        }

        const hasYtAuth =
          cookieMap.has('SAPISID') &&
          (cookieMap.has('LOGIN_INFO') || cookieMap.has('__Secure-3PAPISID') || cookieMap.has('SSID'));

        if (hasYtAuth && !authSettleTimer) {
          logToFile('Detected valid YouTube auth cookies. Waiting 1.2s for session to fully settle...');
          authSettleTimer = setTimeout(async () => {
            if (!authWindow || authWindow.isDestroyed() || isCompleted) return;
            isCompleted = true;
            if (checkInterval) {
              clearInterval(checkInterval);
              checkInterval = null;
            }

            logToFile('Google login completed! Building clean deduplicated YouTube Music session cookies.');
            const finalCookies = await authSession.cookies.get({});
            const finalYt = finalCookies.filter((c) => c.domain && c.domain.includes('youtube.com'));
            const finalGoogle = finalCookies.filter(
              (c) => c.domain && c.domain.includes('google.com') && !c.domain.includes('youtube.com')
            );

            const finalMap = new Map();
            for (const c of finalGoogle) {
              if (c.name && c.value) finalMap.set(c.name, c.value);
            }
            for (const c of finalYt) {
              if (c.name && c.value) finalMap.set(c.name, c.value);
            }

            const cleanCookieString = Array.from(finalMap.entries())
              .map(([k, v]) => `${k}=${v}`)
              .join('; ');

            saveCookie(cleanCookieString);
            const profile = await initYouTube(cleanCookieString);

            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('auth:changed', profile);
            }

            if (authWindow && !authWindow.isDestroyed()) {
              authWindow.destroy();
            }
            authWindow = null;

            if (loginResolver) {
              loginResolver(profile);
              loginResolver = null;
            }
          }, 1200);
        }
      } catch (err) {
        logToFile('Error checking login cookies:', err);
      }
    };

    checkInterval = setInterval(checkCookies, 1000);

    authWindow.webContents.on('did-navigate', async () => {
      await checkCookies();
    });

    authWindow.webContents.on('did-frame-navigate', async () => {
      await checkCookies();
    });

    authWindow.webContents.on('did-finish-load', async () => {
      await checkCookies();
    });

    authWindow.on('closed', () => {
      if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
      }
      if (authSettleTimer) {
        clearTimeout(authSettleTimer);
        authSettleTimer = null;
      }
      authWindow = null;
      if (!isCompleted && loginResolver) {
        loginResolver(userProfile);
        loginResolver = null;
      }
    });
  });
}

// Register IPC handlers
function registerIpcHandlers() {
  ipcMain.handle('auth:login', async () => {
    const profile = await openGoogleLogin();
    return { ok: true, userProfile: profile };
  });

  ipcMain.handle('auth:importCookie', async (_event, cookieStr) => {
    if (!cookieStr || !cookieStr.trim()) return { ok: false, error: 'Empty cookie string' };
    saveCookie(cookieStr.trim());
    const profile = await initYouTube(cookieStr.trim());
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('auth:changed', profile);
    }
    return { ok: true, userProfile: profile };
  });

  ipcMain.handle('auth:logout', async () => {
    clearSavedCookie();
    await session.fromPartition('persist:google_auth').clearStorageData();
    const profile = await initYouTube('');
    if (playerWindow && !playerWindow.isDestroyed()) {
      playerWindow.destroy();
      playerWindow = null;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('auth:changed', profile);
    }
    return { ok: true, userProfile: profile };
  });

  ipcMain.handle('auth:status', async () => {
    if (initPromise) {
      await initPromise;
    }
    return userProfile;
  });

  // Legacy Player IPC Handlers (Renderer manages playback directly via HTML5 audio)
  ipcMain.handle('player:loadTrack', async () => ({ ok: true }));
  ipcMain.handle('player:play', async () => true);
  ipcMain.handle('player:pause', async () => true);
  ipcMain.handle('player:next', async () => {});
  ipcMain.handle('player:previous', async () => {});
  ipcMain.handle('player:seek', async () => {});
  ipcMain.handle('player:setVolume', async () => {});

  // YouTube Music Handlers
  ipcMain.handle('yt:search', async (_event, { query, type }) => {
    if (initPromise) await initPromise;
    if (!yt) return { results: [] };
    try {
      logToFile('Executing yt.music.search for query:', query, 'type:', type);
      const searchRes = await yt.music.search(query, type ? { type } : undefined);
      const items = extractTracksFromSearch(searchRes);
      if (items.length > 0) {
        logToFile(`Search found ${items.length} tracks for query: ${query}`);
        return { results: items };
      }

      // Intermediate fallback: direct InnerTube /search with YTMUSIC client
      try {
        const directSearch = await yt.actions.execute('/search', { query, client: 'YTMUSIC' });
        if (directSearch?.data) {
          const directItems = extractTracksFromBrowseData(directSearch.data);
          if (directItems.length > 0) {
            logToFile(`Direct /search found ${directItems.length} tracks for query: ${query}`);
            return { results: directItems };
          }
        }
      } catch (e) {}
    } catch (err) {
      logToFile('yt.music.search error, trying fallback:', err?.message || err);
    }

    // Fallback: yt.search (Standard YouTube search that never fails)
    try {
      logToFile('Running fallback yt.search for query:', query);
      const fallbackRes = await yt.search(query, { type: 'video' });
      const rawVideos = fallbackRes.videos || fallbackRes.results || [];
      const fallbackItems = rawVideos
        .map((v) => ({
          id: v.id,
          title: v.title?.text || v.title?.toString() || 'Track',
          artists: parseArtistsFromItem(v),
          thumbnail: getThumbnailUrl(v) || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
          duration: v.duration?.text || '',
          durationSeconds: v.duration?.seconds || null,
          type: 'track',
        }))
        .filter((t) => t.id && t.title);

      logToFile(`Fallback search found ${fallbackItems.length} tracks for query: ${query}`);
      return { results: fallbackItems };
    } catch (fbErr) {
      logToFile('Fallback search also failed:', fbErr?.message || fbErr);
      return { results: [], error: fbErr?.message || 'Search failed' };
    }
  });

  ipcMain.handle('yt:getSearchSuggestions', async (_event, query) => {
    if (initPromise) await initPromise;
    if (!yt) return { suggestions: [] };
    try {
      const q = typeof query === 'string' ? query : '';
      const sections = await yt.music.getSearchSuggestions(q);
      const suggestions = [];

      for (const sec of sections || []) {
        for (const item of sec.contents || []) {
          const text =
            item.suggestion?.text ||
            item.suggestion?.toString() ||
            item.title?.text ||
            item.title?.toString() ||
            item.endpoint?.payload?.query ||
            '';
          const isHistory = item.type === 'HistorySuggestion';

          if (text) {
            suggestions.push({
              text,
              isHistory,
              type: item.type,
            });
          }
        }
      }

      const seen = new Set();
      const deduped = suggestions.filter((s) => {
        const lower = s.text.toLowerCase().trim();
        if (seen.has(lower)) return false;
        seen.add(lower);
        return true;
      });

      return { suggestions: deduped };
    } catch (err) {
      logToFile('getSearchSuggestions error:', err);
      return { suggestions: [], error: err.message };
    }
  });

  ipcMain.handle('yt:likeSong', async (_event, videoId) => {
    if (initPromise) await initPromise;
    if (!yt) return { ok: false, error: 'InnerTube not ready' };
    try {
      logToFile('Liking song on YouTube:', videoId);
      const res = await yt.actions.execute('/like/like', {
        target: { videoId },
        client: 'YTMUSIC',
      });
      return { ok: true, status: res.status_code || 200 };
    } catch (err) {
      logToFile('Error liking song:', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('yt:unlikeSong', async (_event, videoId) => {
    if (initPromise) await initPromise;
    if (!yt) return { ok: false, error: 'InnerTube not ready' };
    try {
      logToFile('Unliking song on YouTube:', videoId);
      const res = await yt.actions.execute('/like/removelike', {
        target: { videoId },
        client: 'YTMUSIC',
      });
      return { ok: true, status: res.status_code || 200 };
    } catch (err) {
      logToFile('Error unliking song:', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('yt:subscribeArtist', async (_event, channelId) => {
    if (initPromise) await initPromise;
    if (!yt) return { ok: false, error: 'InnerTube not ready' };
    try {
      logToFile('Subscribing to artist channel:', channelId);
      const res = await yt.actions.execute('/subscription/subscribe', {
        channelIds: [channelId],
        client: 'YTMUSIC',
      });
      return { ok: true, status: res.status_code || 200 };
    } catch (err) {
      logToFile('Error subscribing to artist:', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('yt:unsubscribeArtist', async (_event, channelId) => {
    if (initPromise) await initPromise;
    if (!yt) return { ok: false, error: 'InnerTube not ready' };
    try {
      logToFile('Unsubscribing from artist channel:', channelId);
      const res = await yt.actions.execute('/subscription/unsubscribe', {
        channelIds: [channelId],
        client: 'YTMUSIC',
      });
      return { ok: true, status: res.status_code || 200 };
    } catch (err) {
      logToFile('Error unsubscribing from artist:', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('yt:createPlaylist', async (_event, { title, videoIds, description }) => {
    if (initPromise) await initPromise;
    if (!yt) return { ok: false, error: 'InnerTube not ready' };
    try {
      logToFile('Creating playlist on YouTube Music:', title);
      const res = await yt.playlist.create(title, videoIds || []);
      return {
        ok: true,
        playlistId: res.playlist_id,
        status: res.status_code || 200,
      };
    } catch (err) {
      logToFile('Error creating playlist:', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('yt:addToPlaylist', async (_event, { playlistId, videoIds }) => {
    if (initPromise) await initPromise;
    if (!yt) return { ok: false, error: 'InnerTube not ready' };
    try {
      logToFile('Adding videos to playlist:', playlistId, videoIds);
      let targetId = playlistId;
      if (targetId.startsWith('VL')) targetId = targetId.substring(2);

      const ids = Array.isArray(videoIds) ? videoIds : [videoIds];
      const actions = ids.map((vId) => ({
        addedVideoId: vId,
        action: 'ACTION_ADD_VIDEO',
      }));

      try {
        const editRes = await yt.actions.execute('/browse/edit_playlist', {
          playlistId: targetId,
          actions,
          client: 'YTMUSIC',
        });
        return { ok: true, result: editRes.data };
      } catch (innerErr) {
        // Fallback to yt.playlist.addVideos
        const res = await yt.playlist.addVideos(targetId, ids);
        return { ok: true, result: res };
      }
    } catch (err) {
      logToFile('Error adding to playlist:', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('yt:deletePlaylist', async (_event, playlistId) => {
    if (initPromise) await initPromise;
    if (!yt) return { ok: false, error: 'InnerTube not ready' };
    try {
      logToFile('Deleting playlist on YouTube Music:', playlistId);
      let targetId = playlistId;
      if (targetId.startsWith('VL')) targetId = targetId.substring(2);
      const res = await yt.actions.execute('/playlist/delete', {
        playlistId: targetId,
        client: 'YTMUSIC',
      });
      return { ok: true, status: res.status_code || 200 };
    } catch (err) {
      logToFile('Error deleting playlist:', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('yt:getHome', async () => {
    if (initPromise) await initPromise;
    if (!yt) return { sections: [] };
    try {
      logToFile('Fetching complete Home Feed with continuations...');
      const home = await yt.music.getHomeFeed();
      const allSections = [...(home.sections || [])];

      // Fetch up to 4 continuation pages so all shelves (Quick picks, Listen again, etc.) load!
      let currentFeed = home;
      let pages = 0;
      while (currentFeed && typeof currentFeed.getContinuation === 'function' && pages < 4) {
        try {
          currentFeed = await currentFeed.getContinuation();
          if (currentFeed?.sections && currentFeed.sections.length > 0) {
            allSections.push(...currentFeed.sections);
            pages++;
          } else {
            break;
          }
        } catch (e) {
          break;
        }
      }

      const sections = allSections
        .map((sec) => ({
          title:
            sec.header?.title?.text || sec.title?.text || sec.title?.toString() || 'Recommended for You',
          contents: (sec.contents || sec.items || [])
            .map((item) => {
              const artists = parseArtistsFromItem(item);
              const subtitle = item.subtitle?.text || item.subtitle?.toString() || '';
              return {
                id: item.id || item.videoId || item.endpoint?.payload?.videoId || null,
                title: item.title?.text || item.title?.toString() || '',
                subtitle: subtitle || artists.map((a) => a.name).join(', '),
                artists,
                thumbnail:
                  item.thumbnails?.[item.thumbnails.length - 1]?.url ||
                  item.thumbnail?.[0]?.url ||
                  null,
                type: item.type || 'item',
              };
            })
            .filter((i) => i.id && i.title),
        }))
        .filter((sec) => sec.contents.length > 0);

      logToFile(`Home Feed loaded with ${sections.length} total sections!`);
      return { sections };
    } catch (err) {
      logToFile('Get Home Feed error:', err);
      return { sections: [], error: err.message };
    }
  });

  ipcMain.handle('yt:getPlaylists', async () => {
    if (initPromise) await initPromise;
    if (!yt) return { playlists: [] };
    try {
      logToFile('Fetching user playlists via FEmusic_liked_playlists');
      try {
        const res = await yt.actions.execute('/browse', { browseId: 'FEmusic_liked_playlists', client: 'YTMUSIC' });
        const gridItems =
          res?.data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
            ?.sectionListRenderer?.contents?.[0]?.gridRenderer?.items || [];

        const playlists = [];
        for (const item of gridItems) {
          const r = item.musicTwoRowItemRenderer;
          if (!r) continue;
          const title = r.title?.runs?.[0]?.text || r.title?.text || '';
          if (!title || title.toLowerCase() === 'new playlist') continue; // Skip create button

          const browseId = r.navigationEndpoint?.browseEndpoint?.browseId || '';
          let playlistId = browseId;
          if (playlistId.startsWith('VL')) playlistId = playlistId.substring(2);

          const thumbs = r.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails;
          const thumbnail = thumbs && thumbs.length > 0 ? thumbs[thumbs.length - 1]?.url : null;
          const subtitle = r.subtitle?.runs?.map((s) => s.text).join('') || '';

          playlists.push({
            id: playlistId,
            title,
            thumbnail,
            subtitle,
            itemCount: null,
            author: userProfile?.name || 'You',
          });
        }

        if (playlists.length > 0) {
          logToFile(`Fetched ${playlists.length} playlists via FEmusic_liked_playlists`);
          return { playlists };
        }
      } catch (err) {
        logToFile('FEmusic_liked_playlists browse error, falling back to getLibrary:', err.message);
      }

      const library = await yt.music.getLibrary();
      const grid = library.contents?.find((c) => c.type === 'Grid') || library.contents?.[0];
      const items = grid?.items || [];
      const playlists = items
        .filter((i) => i.item_type === 'playlist')
        .map((p) => ({
          id: p.id,
          title: p.title?.text || p.title?.toString() || 'Playlist',
          thumbnail: p.thumbnail?.[0]?.url || null,
          itemCount: p.item_count || null,
          author: userProfile?.name || 'You',
        }));

      return { playlists };
    } catch (err) {
      logToFile('Get Playlists error:', err);
      return { playlists: [], error: err.message };
    }
  });

  ipcMain.handle('yt:getPlaylist', async (_event, playlistId) => {
    if (initPromise) await initPromise;
    if (!yt) return { tracks: [] };
    try {
      logToFile('Fetching playlist tracks for playlistId:', playlistId);

      const isLikedMusic = playlistId === 'LM' || playlistId === 'VLLM' || playlistId === 'FEmusic_liked_videos';
      const browseIdsToTry = isLikedMusic
        ? ['FEmusic_liked_videos', 'VLLM', 'LM']
        : [
            playlistId.startsWith('VL') || playlistId.startsWith('PL') ? playlistId : `VL${playlistId}`,
            playlistId,
          ];

      let parsedTracks = [];
      let playlistTitle = isLikedMusic ? 'Liked Music' : 'Playlist';
      let headerThumb = null;

      for (const browseId of browseIdsToTry) {
        try {
          logToFile('Attempting /browse for:', browseId);
          const res = await yt.actions.execute('/browse', { browseId, client: 'YTMUSIC' });
          const data = res?.data;
          if (data) {
            const tracks = extractTracksFromBrowseData(data);
            if (tracks.length > 0) {
              parsedTracks = tracks;
              logToFile(`Extracted ${tracks.length} tracks via browseId: ${browseId}`);

              const header =
                data.header?.musicResponsiveHeaderRenderer ||
                data.header?.musicDetailHeaderRenderer ||
                data.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.musicResponsiveHeaderRenderer;
              if (header?.title?.runs?.[0]?.text || header?.title?.text) {
                playlistTitle = header.title.runs?.[0]?.text || header.title.text;
              }
              const thumbs = header?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails;
              if (thumbs && thumbs.length > 0) {
                headerThumb = thumbs[thumbs.length - 1]?.url;
              }
              break;
            }
          }
        } catch (e) {
          logToFile(`Browse error for ${browseId}:`, e.message);
        }
      }

      // Fallback: yt.music.getPlaylist
      if (parsedTracks.length === 0) {
        logToFile('Falling back to yt.music.getPlaylist for:', playlistId);
        try {
          const pl = await yt.music.getPlaylist(playlistId);
          if (pl) {
            playlistTitle = pl.header?.title?.text || pl.header?.title?.toString() || playlistTitle;
            const rawItems = pl.items || pl.contents || [];
            parsedTracks = rawItems
              .map((item) => ({
                id: item.id || item.videoId,
                title: typeof item.title === 'string' ? item.title : (item.title?.text || item.title?.toString() || ''),
                artists: parseArtistsFromItem(item),
                album: item.album ? { name: item.album.name || item.album.toString(), id: item.album.id } : null,
                duration: typeof item.duration === 'string' ? item.duration : (item.duration?.text || ''),
                thumbnail: item.thumbnails?.[item.thumbnails.length - 1]?.url || null,
              }))
              .filter((t) => t.id && t.title);
          }
        } catch (e) {
          logToFile('yt.music.getPlaylist error:', e.message);
        }
      }

      return {
        id: playlistId,
        title: playlistTitle,
        thumbnail: headerThumb || parsedTracks[0]?.thumbnail || null,
        tracks: parsedTracks,
      };
    } catch (err) {
      logToFile('Get Playlist tracks error:', err.message);
      return { tracks: [], error: err.message };
    }
  });

  ipcMain.handle('yt:getLikedSongs', async (_event) => {
    if (initPromise) await initPromise;
    if (!yt) return { tracks: [] };
    try {
      const browseIds = ['FEmusic_liked_videos', 'VLLM', 'LM'];
      for (const browseId of browseIds) {
        try {
          const res = await yt.actions.execute('/browse', { browseId, client: 'YTMUSIC' });
          if (res?.data) {
            const tracks = extractTracksFromBrowseData(res.data);
            if (tracks.length > 0) {
              logToFile(`Fetched ${tracks.length} liked songs via ${browseId}`);
              return { id: 'LM', title: 'Liked Music', tracks };
            }
          }
        } catch (e) {
          logToFile(`Liked songs browse ${browseId} error:`, e.message);
        }
      }
      return { id: 'LM', title: 'Liked Music', tracks: [] };
    } catch (err) {
      logToFile('Get Liked Songs error:', err.message);
      return { tracks: [], error: err.message };
    }
  });

  ipcMain.handle('yt:getHistory', async () => {
    if (initPromise) await initPromise;
    if (!yt) return { sections: [] };
    try {
      logToFile('Fetching real YouTube Music history via FEmusic_history');
      const res = await yt.actions.execute('/browse', {
        browseId: 'FEmusic_history',
        client: 'YTMUSIC',
      });

      const sectionList =
        res.data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
          ?.sectionListRenderer?.contents || [];
      const sections = [];

      for (const s of sectionList) {
        const shelf = s.musicShelfRenderer;
        if (!shelf) continue;
        const sectionTitle = shelf.title?.runs?.map((r) => r.text).join('') || 'Recently Played';
        const contents = [];

        for (const item of shelf.contents || []) {
          const r = item.musicResponsiveListItemRenderer;
          if (!r) continue;

          const flexCols = r.flexColumns || [];
          const col0Runs =
            flexCols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
          const col1Runs =
            flexCols[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
          const col2Runs =
            flexCols[2]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];

          const title = col0Runs.map((x) => x.text).join('');
          const videoId =
            r.playlistItemData?.videoId ||
            col0Runs[0]?.navigationEndpoint?.watchEndpoint?.videoId ||
            r.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer
              ?.playNavigationEndpoint?.watchEndpoint?.videoId;

          if (!videoId || !title) continue;

          const artistName = col1Runs[0]?.text || '';
          const albumName = col2Runs[0]?.text || '';

          const thumbs = r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
          const thumbnail = thumbs[thumbs.length - 1]?.url || null;

          const duration =
            r.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.runs
              ?.map((x) => x.text)
              .join('') || '';

          contents.push({
            id: videoId,
            title,
            artists: artistName ? [{ name: artistName }] : [{ name: 'YouTube Music' }],
            album: albumName ? { name: albumName } : null,
            duration,
            thumbnail,
          });
        }

        if (contents.length > 0) {
          sections.push({ title: sectionTitle, contents });
        }
      }

      if (sections.length > 0) {
        return { sections };
      }

      return { sections: [] };
    } catch (err) {
      logToFile('Get History error:', err);
      return { sections: [], error: err.message };
    }
  });

  ipcMain.handle('yt:getSubscribedArtists', async () => {
    if (initPromise) await initPromise;
    if (!yt) return { artists: [] };
    try {
      logToFile('Fetching Subscribed Artists via FEmusic_library_corpus_artists');
      const res = await yt.actions.execute('/browse', {
        browseId: 'FEmusic_library_corpus_artists',
        client: 'YTMUSIC',
      });

      const shelf =
        res.data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
          ?.sectionListRenderer?.contents?.[0]?.musicShelfRenderer;
      const items = shelf?.contents || [];
      const artists = [];

      for (const item of items) {
        const r = item.musicResponsiveListItemRenderer;
        if (!r) continue;

        const flexCols = r.flexColumns || [];
        const nameRuns =
          flexCols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
        const name = nameRuns.map((x) => x.text).join('');
        const artistId =
          r.navigationEndpoint?.browseEndpoint?.browseId ||
          nameRuns[0]?.navigationEndpoint?.browseEndpoint?.browseId ||
          null;

        const subRuns =
          flexCols[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
        const subscribers = subRuns.map((x) => x.text).join('');

        const thumbs = r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
        const thumbnail = thumbs[thumbs.length - 1]?.url || null;

        if (name) {
          artists.push({
            id: artistId,
            name,
            subscribers,
            thumbnail,
          });
        }
      }

      return { artists };
    } catch (err) {
      logToFile('Get Subscribed Artists error:', err);
      return { artists: [], error: err.message };
    }
  });

  ipcMain.handle('yt:getArtist', async (_event, artistId) => {
    if (initPromise) await initPromise;
    if (!yt) return { artist: null };
    try {
      logToFile('Fetching artist details for:', artistId);
      const artist = await yt.music.getArtist(artistId);

      const header = {
        name: artist.header?.title?.text || artist.header?.title?.toString() || 'Artist',
        description: artist.header?.description?.text || '',
        subscribers: artist.header?.subscription_button?.subscribe_accessibility_label || '',
        thumbnail:
          artist.header?.thumbnail?.contents?.[artist.header?.thumbnail?.contents?.length - 1]?.url ||
          null,
      };

      const sections = (artist.sections || [])
        .map((sec) => {
          const title = sec.title?.text || sec.title?.toString() || 'Songs';
          const tracks = (sec.contents || [])
            .map((item) => {
              const videoId = item.id || item.videoId || item.endpoint?.payload?.videoId;
              const trackTitle = item.title?.text || item.title?.toString() || '';
              const subtitle = item.subtitle?.text || item.subtitle?.toString() || '';
              const artists =
                item.artists?.map((a) => ({ name: a.name })) || [{ name: header.name }];
              const album = item.album ? { name: item.album.name } : null;
              const duration = item.duration?.text || '';
              const thumbnail =
                item.thumbnails?.[item.thumbnails.length - 1]?.url ||
                item.thumbnail?.[0]?.url ||
                null;

              return {
                id: videoId,
                title: trackTitle,
                subtitle,
                artists,
                album,
                duration,
                thumbnail,
              };
            })
            .filter((t) => t.id && t.title);

          return { title, tracks };
        })
        .filter((s) => s.tracks.length > 0);

      return {
        id: artistId,
        header,
        sections,
      };
    } catch (err) {
      logToFile('Get Artist error:', err);
      return { artist: null, error: err.message };
    }
  });

  ipcMain.handle('yt:getSongStream', async (_event, videoId) => {
    try {
      logToFile('Resolving stream for videoId:', videoId);
      const sc = await getStreamClient();

      // Primary clients that return direct, unenciphered stream URLs (matching AirBeats architecture)
      // Dedicated guest client sc is used so user cookies are not sent, avoiding HTTP 400 errors.
      const clients = ['VISIONOS', 'ANDROID_VR', 'IOS'];
      for (const client of clients) {
        try {
          const res = await sc.actions.execute('/player', { videoId, client });
          if (res.data?.playabilityStatus?.status !== 'OK') {
            logToFile(`Client ${client} playabilityStatus not OK:`, res.data?.playabilityStatus?.status, res.data?.playabilityStatus?.reason);
            continue;
          }
          const formats = res.data?.streamingData?.adaptiveFormats || res.data?.streamingData?.formats || [];
          const audioFormats = formats.filter((f) => f.mimeType && f.mimeType.includes('audio'));
          if (audioFormats.length > 0) {
            audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
            const best = audioFormats[0];
            if (best.url) {
              logToFile(`Resolved stream via ${client}:`, best.mimeType, 'bitrate:', best.bitrate);
              return {
                streamUrl: best.url,
                format: {
                  container: best.mimeType.split(';')[0],
                  codec: best.mimeType,
                  bitrate: best.bitrate,
                  audioQuality: best.audioQuality,
                  contentLength: best.contentLength,
                },
                metadata: {
                  title: res.data?.videoDetails?.title || '',
                  author: res.data?.videoDetails?.author || '',
                  duration: parseInt(res.data?.videoDetails?.lengthSeconds || '0', 10),
                },
              };
            }
          }
        } catch (clientErr) {
          logToFile(`Client ${client} error:`, clientErr.message);
        }
      }

      // Fallback: sc.getInfo() with decipher
      try {
        const info = await sc.getInfo(videoId);
        const format = info.chooseFormat({ type: 'audio', quality: 'best' });
        if (format) {
          let streamUrl = null;
          try {
            streamUrl = await format.decipher(sc.session.player);
          } catch (e) {
            streamUrl = format.url;
          }
          if (streamUrl) {
            logToFile('Resolved stream via getInfo decipher:', format.mime_type, 'bitrate:', format.bitrate);
            return {
              streamUrl,
              format: {
                container: format.container,
                codec: format.codecs,
                bitrate: format.bitrate,
                audioQuality: format.audio_quality,
              },
              metadata: {
                title: info.basic_info?.title || '',
                author: info.basic_info?.author || '',
                duration: info.basic_info?.duration || 0,
                thumbnail:
                  info.basic_info?.thumbnail?.[info.basic_info?.thumbnail?.length - 1]?.url || null,
              },
            };
          }
        }
      } catch (decipherErr) {
        logToFile('Decipher fallback error:', decipherErr.message);
      }

      return { streamUrl: null, error: 'No playable stream formats found' };
    } catch (err) {
      logToFile('Stream resolution error for videoId', videoId, err);
      return { streamUrl: null, error: err.message };
    }
  });

  ipcMain.handle('yt:getLyrics', async (_event, videoId) => {
    if (initPromise) await initPromise;
    if (!yt) return { lyrics: null };
    try {
      const lyrics = await yt.music.getLyrics(videoId);
      return {
        lyrics: lyrics?.description?.text || lyrics?.text || null,
        source: 'YouTube Music',
      };
    } catch (err) {
      return { lyrics: null, error: err.message };
    }
  });

  // Window Controls
  ipcMain.on('window:minimize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
  });
  ipcMain.on('window:maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      else mainWindow.maximize();
    }
  });
  ipcMain.on('window:close', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
  });
}

app.whenReady().then(async () => {
  if (app.userAgentFallback) {
    app.userAgentFallback = app.userAgentFallback
      .replace(/Electron\/[^\s]+\s*/i, '')
      .replace(/itune-desktop\/[^\s]+\s*/i, '')
      .replace(/iTune Desktop\/[^\s]+\s*/i, '')
      .trim();
  }
  registerIpcHandlers();
  const savedCookie = loadSavedCookie();
  initYouTube(savedCookie);
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
