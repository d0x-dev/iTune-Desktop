const { app, ipcMain } = require('electron');
const path = require('path');

app.whenReady().then(async () => {
  // Load main.js
  require(path.join(__dirname, '../electron/main.js'));

  // Wait 2s for Innertube to init with saved cookie
  setTimeout(async () => {
    console.log('Testing yt:getSongStream via IPC handler directly...');
    
    // Simulate IPC call to 'yt:getSongStream'
    const eventSim = {};
    const videoId = '48ydDUQ16RE';
    
    // Grab the registered handler
    const handler = ipcMain._invokeHandlers?.get('yt:getSongStream');
    if (!handler) {
      console.error('Handler yt:getSongStream NOT REGISTERED!');
      app.quit();
      return;
    }

    try {
      const res = await handler(eventSim, videoId);
      console.log('getSongStream Result:');
      console.log('has streamUrl:', !!res.streamUrl);
      if (res.streamUrl) {
        console.log('Stream URL preview:', res.streamUrl.slice(0, 80));
        console.log('Format:', res.format);
        console.log('Metadata:', res.metadata);
      } else {
        console.error('Error:', res.error);
      }
    } catch (e) {
      console.error('Execution error:', e);
    }

    app.quit();
  }, 2500);
});
