const { app, BrowserWindow } = require('electron');
const http = require('http');

app.whenReady().then(async () => {
  const { Innertube } = await import('youtubei.js');
  const yt = await Innertube.create();

  let streamInfo = null;

  async function resolveStream() {
    for (const client of ['ANDROID_VR', 'IOS', 'TVHTML5']) {
      try {
        const res = await yt.actions.execute('/player', { videoId: 'kXYiU_JCYtU', client });
        const formats = res.data?.streamingData?.adaptiveFormats || [];
        // Prefer itag 140 (audio/mp4 m4a 128k) or 251 (audio/webm opus 160k)
        const audioFormat = formats.find(f => f.itag === 140) || formats.find(f => f.mimeType && f.mimeType.includes('audio'));
        if (audioFormat && audioFormat.url) {
          return {
            url: audioFormat.url,
            contentLength: parseInt(audioFormat.contentLength || 0, 10),
            mimeType: audioFormat.mimeType.split(';')[0],
            client
          };
        }
      } catch (e) {}
    }
    throw new Error('No audio format found');
  }

  streamInfo = await resolveStream();
  console.log('Resolved stream:', streamInfo.mimeType, 'total length:', streamInfo.contentLength);

  const server = http.createServer(async (req, res) => {
    try {
      const totalSize = streamInfo.contentLength;
      const rangeHeader = req.headers.range;

      let start = 0;
      let requestedEnd = totalSize ? totalSize - 1 : null;

      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        start = parseInt(parts[0], 10) || 0;
        if (parts[1]) {
          requestedEnd = parseInt(parts[1], 10);
        }
      }

      console.log(`Client requested range: bytes=${start}-${requestedEnd !== null ? requestedEnd : ''}`);

      const finalEnd = requestedEnd !== null ? requestedEnd : (totalSize ? totalSize - 1 : start + 10 * 1024 * 1024);
      const contentLength = finalEnd - start + 1;

      res.writeHead(rangeHeader ? 206 : 200, {
        'Content-Type': streamInfo.mimeType,
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${finalEnd}/${totalSize || '*'}`,
        'Content-Length': contentLength.toString(),
        'Access-Control-Allow-Origin': '*'
      });

      // Stream in 1MB chunks from YouTube CDN until finalEnd
      const CHUNK_SIZE = 1024 * 1024;
      let curStart = start;

      let aborted = false;
      req.on('close', () => { aborted = true; });

      while (curStart <= finalEnd && !aborted) {
        const curEnd = Math.min(curStart + CHUNK_SIZE - 1, finalEnd);
        
        const ytRes = await fetch(streamInfo.url, {
          headers: {
            'Range': `bytes=${curStart}-${curEnd}`,
            'User-Agent': 'com.google.android.apps.youtube.vr.oculus/1.37'
          }
        });

        if (!ytRes.ok && ytRes.status !== 206) {
          console.error(`Upstream chunk error: ${ytRes.status}`);
          break;
        }

        const reader = ytRes.body.getReader();
        while (!aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }

        curStart = curEnd + 1;
      }

      if (!aborted) res.end();
    } catch (err) {
      console.error('Server error:', err);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  });

  server.listen(39294, '127.0.0.1', () => {
    console.log('Stream server listening on 39294');

    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        webSecurity: false
      }
    });

    win.loadURL('data:text/html,<html><body><audio id="player" controls></audio></body></html>');

    win.webContents.on('did-finish-load', async () => {
      console.log('Window loaded, playing stream from local proxy...');

      const result = await win.webContents.executeJavaScript(`
        new Promise((resolve) => {
          const audio = document.getElementById('player');
          audio.src = 'http://127.0.0.1:39294/stream';
          
          audio.onplay = () => console.log('Audio playing!');
          
          audio.ontimeupdate = () => {
            if (audio.currentTime > 2) {
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

      console.log('PLAYBACK TEST RESULT:', result);
      server.close();
      app.quit();
    });
  });
});
