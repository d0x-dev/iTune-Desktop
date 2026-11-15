const http = require('http');
const { Innertube } = require('youtubei.js');

async function main() {
  const yt = await Innertube.create();
  
  const streamCache = new Map();

  async function getStreamInfo(videoId) {
    if (streamCache.has(videoId)) return streamCache.get(videoId);
    
    // Try ANDROID_VR first, then IOS, then TVHTML5
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
          console.log(`Resolved stream via ${client}: ${info.mimeType}, length: ${info.contentLength}`);
          streamCache.set(videoId, info);
          return info;
        }
      } catch (e) {
        console.warn(`${client} failed:`, e.message);
      }
    }
    throw new Error('No stream formats found');
  }

  const server = http.createServer(async (req, res) => {
    const urlObj = new URL(req.url, 'http://127.0.0.1:39291');
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

        console.log(`Proxying range: bytes=${start}-${end}/${totalSize || '*'}`);

        const ytRes = await fetch(streamInfo.url, {
          headers: {
            'Range': `bytes=${start}-${end}`,
            'User-Agent': 'com.google.android.apps.youtube.vr.oculus/1.37'
          }
        });

        if (!ytRes.ok && ytRes.status !== 206) {
          console.error('Upstream error:', ytRes.status);
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
      console.error('Proxy error:', err);
      res.writeHead(500);
      res.end(err.message);
    }
  });

  server.listen(39291, '127.0.0.1', async () => {
    console.log('Test proxy server running on http://127.0.0.1:39291');

    console.log('Sending client test request with Range: bytes=0-1000...');
    const testRes = await fetch('http://127.0.0.1:39291/stream/kXYiU_JCYtU', {
      headers: { 'Range': 'bytes=0-1000' }
    });
    console.log('Client response status:', testRes.status);
    console.log('Client Content-Range:', testRes.headers.get('content-range'));
    console.log('Client Content-Type:', testRes.headers.get('content-type'));
    const buf = await testRes.arrayBuffer();
    console.log('Client received bytes:', buf.byteLength);

    server.close(() => {
      console.log('Test completed successfully and server closed.');
      process.exit(0);
    });
  });
}

main();
