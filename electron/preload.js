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
    unlikeSong: (videoId) => ipcRenderer.invoke("yt:unlikeSong", videoId),
    getSongStream: (videoId, quality) =>
      ipcRenderer.invoke("yt:getSongStream", { videoId, quality }),
    reportPlayback: (videoId, seconds) =>
      ipcRenderer.invoke("yt:reportPlayback", { videoId, seconds }),
    downloadSong: (data) => ipcRenderer.invoke("download:song", data),
    getLyrics: (videoId, metadata) =>
      ipcRenderer.invoke("yt:getLyrics", videoId, metadata),
    searchLyrics: (videoId, metadata) =>
      ipcRenderer.invoke("yt:searchLyrics", videoId, metadata),
    translateLyrics: (lines, targetLanguage, mode) =>
      ipcRenderer.invoke("yt:translateLyrics", {
        lines,
        targetLanguage,
        mode,
      }),
  },
  settings: {
    getAITranslation: () => ipcRenderer.invoke("settings:getAITranslation"),
    saveAITranslation: (config) =>
      ipcRenderer.invoke("settings:saveAITranslation", config),
  },
  ishare: {
    create: (displayName, state) =>
      ipcRenderer.invoke("ishare:create", displayName, state),
    join: (code, displayName) =>
      ipcRenderer.invoke("ishare:join", code, displayName),
    get: (code) => ipcRenderer.invoke("ishare:get", code),
    update: (code, participantId, state) =>
      ipcRenderer.invoke("ishare:update", code, participantId, state),
    leave: (code, participantId) =>
      ipcRenderer.invoke("ishare:leave", code, participantId),
    lanStart: (options) => ipcRenderer.invoke("ishare:lanStart", options),
    lanStop: () => ipcRenderer.invoke("ishare:lanStop"),
    lanUpdate: (state, settings) =>
      ipcRenderer.invoke("ishare:lanUpdate", state, settings),
    lanScan: () => ipcRenderer.invoke("ishare:lanScan"),
    lanJoin: (address, displayName) =>
      ipcRenderer.invoke("ishare:lanJoin", address, displayName),
    lanGet: (address, participantId) =>
      ipcRenderer.invoke("ishare:lanGet", address, participantId),
    lanAction: (address, participantId, action, payload) =>
      ipcRenderer.invoke(
        "ishare:lanAction",
        address,
        participantId,
        action,
        payload,
      ),
    lanLeave: (address, participantId) =>
      ipcRenderer.invoke("ishare:lanLeave", address, participantId),
  },
  radio: {
    getCountries: () => ipcRenderer.invoke("radio:getCountries"),
    getStations: (options) =>
      ipcRenderer.invoke("radio:getStations", options),
    recordClick: (stationUuid) =>
      ipcRenderer.invoke("radio:recordClick", stationUuid),
  },
  player: {
    loadTrack: (videoId) => ipcRenderer.invoke("player:loadTrack", videoId),
    play: () => ipcRenderer.invoke("player:play"),
    pause: () => ipcRenderer.invoke("player:pause"),
    next: () => ipcRenderer.invoke("player:next"),
    previous: () => ipcRenderer.invoke("player:previous"),
    seek: (seconds) => ipcRenderer.invoke("player:seek", seconds),
    setVolume: (volume) => ipcRenderer.invoke("player:setVolume", volume),
    onStateChange: (callback) => {
      const handler = (_event, state) => callback(state);
      ipcRenderer.on("player:state", handler);
      return () => ipcRenderer.removeListener("player:state", handler);
    },
    onTrackChanged: (callback) => {
      const handler = (_event, track) => callback(track);
      ipcRenderer.on("player:trackChanged", handler);
      return () => ipcRenderer.removeListener("player:trackChanged", handler);
    },
    onEnded: (callback) => {
      const handler = () => callback();
      ipcRenderer.on("player:ended", handler);
      return () => ipcRenderer.removeListener("player:ended", handler);
    },
  },
  window: {
    setAppearance: (theme, glass) =>
      ipcRenderer.send("window:appearance", { theme, glass }),
    minimize: () => ipcRenderer.send("window:minimize"),
    maximize: () => ipcRenderer.send("window:maximize"),
    fullscreen: () => ipcRenderer.send("window:fullscreen"),
    setLyricsFullscreen: (enabled) =>
      ipcRenderer.send("window:lyricsFullscreen", Boolean(enabled)),
    close: () => ipcRenderer.send("window:close"),
  },
  onAuthChanged: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("auth:changed", handler);
    return () => ipcRenderer.removeListener("auth:changed", handler);
  },
});
