const { app, BrowserWindow } = require('electron');
const http = require('http');

let yt = null;
const streamCache = new Map();

async function getStreamInfo(videoId) {
  if (streamCache.has(videoId)) return streamCache.get(videoId);
  
  for (const client of ['ANDROID_VR', 'IOS', 'TVHTML5']) {
    try {
      const res = await yt.actions.execute('/player', { videoId, client });
      const formats = res.data?.streamingData?.adaptiveFormats || [];
      const audioFormats = formats.filter(f => f.mimeType && f.mimeType.includes('audio'));
      if (audioFormats.length > 0) {
        audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
        const best = audioFormats[0];
        const info = {
          url: best.url,
          contentLength: parseInt(best.contentLength || 0, 10),
          mimeType: best.mimeType.split(';')[0],
          client
        };
        streamCache.set(videoId, info);
        return info;
      }
    } catch (e) {}
  }
  throw new Error('No stream formats found');
}

app.whenReady().then(async () => {
  const { Innertube } = await import('youtubei.js');
  yt = await Innertube.create();

  const server = http.createServer(async (req, res) => {
    const urlObj = new URL(req.url, 'http://127.0.0.1:39293');
    const videoId = urlObj.pathname.replace(/^\/stream\/?/, '');
    if (!videoId) {
      res.writeHead(400);
      return res.end('Missing videoId');
    }

    try {
      const streamInfo = await getStreamInfo(videoId);
      const totalSize = streamInfo.contentLength;

      const rangeHeader = req.headers.range;
      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10) || 0;
        const CHUNK_SIZE = 2 * 1024 * 1024;
        let end = parts[1] ? parseInt(parts[1], 10) : (totalSize ? Math.min(start + CHUNK_SIZE - 1, totalSize - 1) : start + CHUNK_SIZE - 1);
        if (totalSize && end >= totalSize) end = totalSize - 1;

        const ytRes = await fetch(streamInfo.url, {
          headers: {
            'Range': `bytes=${start}-${end}`,
            'User-Agent': 'com.google.android.apps.youtube.vr.oculus/1.37'
          }
        });

        if (!ytRes.ok && ytRes.status !== 206) {
          res.writeHead(ytRes.status);
          return res.end();
        }

        const headers = {
          'Content-Range': `bytes ${start}-${end}/${totalSize || '*'}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': (end - start + 1).toString(),
          'Content-Type': streamInfo.mimeType,
          'Access-Control-Allow-Origin': '*'
        };
        res.writeHead(206, headers);
        
        const reader = ytRes.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } else {
        const CHUNK_SIZE = 1024 * 1024;
        const end = totalSize ? Math.min(CHUNK_SIZE - 1, totalSize - 1) : CHUNK_SIZE - 1;
        const ytRes = await fetch(streamInfo.url, {
          headers: {
            'Range': `bytes=0-${end}`,
            'User-Agent': 'com.google.android.apps.youtube.vr.oculus/1.37'
          }
        });
        res.writeHead(200, {
          'Content-Type': streamInfo.mimeType,
          'Accept-Ranges': 'bytes',
          'Content-Length': totalSize ? totalSize.toString() : (end + 1).toString(),
          'Access-Control-Allow-Origin': '*'
        });
        const reader = ytRes.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      }
    } catch (err) {
      res.writeHead(500);
      res.end(err.message);
    }
  });

  server.listen(39293, '127.0.0.1', async () => {
    console.log('Stream server listening on 39293');
    
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        webSecurity: false
      }
    });

    win.loadURL('data:text/html,<html><body><audio id="player" controls></audio></body></html>');

    win.webContents.on('did-finish-load', async () => {
      console.log('Window loaded, starting audio playback test...');
      
      const playbackTest = await win.webContents.executeJavaScript(`
        new Promise((resolve) => {
          const audio = document.getElementById('player');
          audio.src = 'http://127.0.0.1:39293/stream/kXYiU_JCYtU';
          
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
              error: audio.error ? audio.error.message || 'Audio error code ' + audio.error.code : 'Unknown error'
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
          }, 15000);
        });
      `);

      console.log('Audio playback test result:', playbackTest);
      server.close();
      app.quit();
    });
  });
});
