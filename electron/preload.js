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
