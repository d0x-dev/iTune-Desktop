import { useEffect, useState } from "react";

let database;
function openDatabase() {
  if (!database)
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open("itune-artwork", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("assets");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        database = null;
        reject(request.error);
      };
    });
  return database;
}

export async function readAsset(key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction("assets").objectStore("assets").get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveAsset(key, value) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("assets", "readwrite");
    const store = transaction.objectStore("assets");
    if (value == null) store.delete(key);
    else store.put(value, key);
    transaction.oncomplete = () => {
      window.dispatchEvent(
        new CustomEvent("itune-assets-changed", { detail: key }),
      );
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error || new Error("Couldn’t save this file."));
  });
}

export function useMediaAsset(key) {
  const [asset, setAsset] = useState({ key: null, url: null });
  useEffect(() => {
    if (!key) return;
    let active = true;
    let objectUrl;
    let revision = 0;
    const refresh = async () => {
      const requestRevision = ++revision;
      try {
        const blob = await readAsset(key);
        if (!active || requestRevision !== revision) return;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = blob ? URL.createObjectURL(blob) : null;
        setAsset({ key, url: objectUrl });
      } catch {
        if (active && requestRevision === revision)
          setAsset({ key, url: null });
      }
    };
    const onChange = (event) => {
      if (event.detail === key) refresh();
    };
    refresh();
    window.addEventListener("itune-assets-changed", onChange);
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      window.removeEventListener("itune-assets-changed", onChange);
    };
  }, [key]);
  return asset.key === key ? asset.url : null;
}

export function artistAssetId(track) {
  return track?.artistId || track?.artists?.find((artist) => artist.id)?.id;
}
