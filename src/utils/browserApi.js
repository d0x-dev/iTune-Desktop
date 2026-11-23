import { fetchDeveloperNews, newsWebUrl } from "../../shared/developerNews.mjs";
import { fetchFestivalConfig } from "../../shared/festival.mjs";
import packageInfo from "../../package.json";

// The catalog and sign-in APIs are supplied by Electron's preload script.
// Keep the Vite-only view usable when the desktop bridge is unavailable.
export function initializeBrowserApi() {
  if (window.api) return;
  const desktopRequired = async () => {
    throw new Error("Open iTune Desktop to connect your account and listen.");
  };
  window.api = {
    updates: {
      getInfo: async () => ({
        name: "iTune Desktop",
        version: packageInfo.version,
        platform: "web",
        architecture: "browser",
        releasesUrl: "https://github.com/d0x-dev/iTune-Desktop/releases",
