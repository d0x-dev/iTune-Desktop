const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  updates: {
    getInfo: () => ipcRenderer.invoke("updates:getInfo"),
    check: () => ipcRenderer.invoke("updates:check"),
    download: (tag, assetName) =>
      ipcRenderer.invoke("updates:download", tag, assetName),
    install: (assetName) => ipcRenderer.invoke("updates:install", assetName),
    openReleases: () => ipcRenderer.invoke("updates:openReleases"),
    openRepository: () => ipcRenderer.invoke("updates:openRepository"),
    openLicense: () => ipcRenderer.invoke("updates:openLicense"),
    onDownloadProgress: (callback) => {
      const listener = (_event, progress) => callback(progress);
      ipcRenderer.on("updates:downloadProgress", listener);
      return () => ipcRenderer.removeListener("updates:downloadProgress", listener);
    },
  },
  festival: {
    getConfig: () => ipcRenderer.invoke("festival:getConfig"),
  },
  news: {
    getItems: () => ipcRenderer.invoke("news:getItems"),
    openLink: (url) => ipcRenderer.invoke("news:openLink", url),
  },
  artwork: {
    getArtist: (metadata) => ipcRenderer.invoke("artwork:artist", metadata),
    getAlbum: (metadata) => ipcRenderer.invoke("artwork:album", metadata),
    getCanvas: (metadata) => ipcRenderer.invoke("artwork:canvas", metadata),
    getSignature: (metadata) =>
      ipcRenderer.invoke("artwork:signature", metadata),
  },
  auth: {
    login: () => ipcRenderer.invoke("auth:login"),
    logout: () => ipcRenderer.invoke("auth:logout"),
    getStatus: () => ipcRenderer.invoke("auth:status"),
    importCookie: (cookieStr) =>
      ipcRenderer.invoke("auth:importCookie", cookieStr),
  },
  yt: {
    search: (query, type) => ipcRenderer.invoke("yt:search", { query, type }),
    getSearchSuggestions: (query) =>
      ipcRenderer.invoke("yt:getSearchSuggestions", query),
    getHome: (options) => ipcRenderer.invoke("yt:getHome", options),
    getRadioQueue: (videoId, playlistId) =>
      ipcRenderer.invoke("yt:getRadioQueue", videoId, playlistId),
    getPlaylists: () => ipcRenderer.invoke("yt:getPlaylists"),
    getAlbums: () => ipcRenderer.invoke("yt:getAlbums"),
    getSongs: () => ipcRenderer.invoke("yt:getSongs"),
    getAlbum: (albumId) => ipcRenderer.invoke("yt:getAlbum", albumId),
    getPlaylist: (playlistId) =>
      ipcRenderer.invoke("yt:getPlaylist", playlistId),
    createPlaylist: (data) => ipcRenderer.invoke("yt:createPlaylist", data),
    addToPlaylist: (data) => ipcRenderer.invoke("yt:addToPlaylist", data),
    deletePlaylist: (playlistId) =>
      ipcRenderer.invoke("yt:deletePlaylist", playlistId),
    getHistory: () => ipcRenderer.invoke("yt:getHistory"),
    getSubscribedArtists: () => ipcRenderer.invoke("yt:getSubscribedArtists"),
    getArtist: (artistId) => ipcRenderer.invoke("yt:getArtist", artistId),
    subscribeArtist: (channelId) =>
      ipcRenderer.invoke("yt:subscribeArtist", channelId),
    unsubscribeArtist: (channelId) =>
      ipcRenderer.invoke("yt:unsubscribeArtist", channelId),
    getLikedSongs: () => ipcRenderer.invoke("yt:getLikedSongs"),
    likeSong: (videoId) => ipcRenderer.invoke("yt:likeSong", videoId),
