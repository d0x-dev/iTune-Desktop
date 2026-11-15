const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  auth: {
    login: () => ipcRenderer.invoke('auth:login'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getStatus: () => ipcRenderer.invoke('auth:status'),
    importCookie: (cookieStr) => ipcRenderer.invoke('auth:importCookie', cookieStr),
  },
  yt: {
    search: (query, type) => ipcRenderer.invoke('yt:search', { query, type }),
    getSearchSuggestions: (query) => ipcRenderer.invoke('yt:getSearchSuggestions', query),
    getHome: () => ipcRenderer.invoke('yt:getHome'),
    getPlaylists: () => ipcRenderer.invoke('yt:getPlaylists'),
    getPlaylist: (playlistId) => ipcRenderer.invoke('yt:getPlaylist', playlistId),
    createPlaylist: (data) => ipcRenderer.invoke('yt:createPlaylist', data),
    addToPlaylist: (data) => ipcRenderer.invoke('yt:addToPlaylist', data),
    deletePlaylist: (playlistId) => ipcRenderer.invoke('yt:deletePlaylist', playlistId),
    getHistory: () => ipcRenderer.invoke('yt:getHistory'),
    getSubscribedArtists: () => ipcRenderer.invoke('yt:getSubscribedArtists'),
    getArtist: (artistId) => ipcRenderer.invoke('yt:getArtist', artistId),
    subscribeArtist: (channelId) => ipcRenderer.invoke('yt:subscribeArtist', channelId),
    unsubscribeArtist: (channelId) => ipcRenderer.invoke('yt:unsubscribeArtist', channelId),
    getLikedSongs: () => ipcRenderer.invoke('yt:getLikedSongs'),
    likeSong: (videoId) => ipcRenderer.invoke('yt:likeSong', videoId),
    unlikeSong: (videoId) => ipcRenderer.invoke('yt:unlikeSong', videoId),
    getSongStream: (videoId) => ipcRenderer.invoke('yt:getSongStream', videoId),
    getLyrics: (videoId) => ipcRenderer.invoke('yt:getLyrics', videoId),
  },
  player: {
    loadTrack: (videoId) => ipcRenderer.invoke('player:loadTrack', videoId),
    play: () => ipcRenderer.invoke('player:play'),
    pause: () => ipcRenderer.invoke('player:pause'),
    next: () => ipcRenderer.invoke('player:next'),
    previous: () => ipcRenderer.invoke('player:previous'),
    seek: (seconds) => ipcRenderer.invoke('player:seek', seconds),
    setVolume: (volume) => ipcRenderer.invoke('player:setVolume', volume),
    onStateChange: (callback) => {
      const handler = (_event, state) => callback(state);
      ipcRenderer.on('player:state', handler);
      return () => ipcRenderer.removeListener('player:state', handler);
    },
    onTrackChanged: (callback) => {
      const handler = (_event, track) => callback(track);
      ipcRenderer.on('player:trackChanged', handler);
      return () => ipcRenderer.removeListener('player:trackChanged', handler);
    },
    onEnded: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('player:ended', handler);
      return () => ipcRenderer.removeListener('player:ended', handler);
    },
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
  },
  onAuthChanged: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('auth:changed', handler);
    return () => ipcRenderer.removeListener('auth:changed', handler);
  },
});
