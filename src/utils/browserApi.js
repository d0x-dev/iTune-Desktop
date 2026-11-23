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
      }),
      check: async () => ({ releases: [], latestRelease: null, updateAvailable: false }),
      download: desktopRequired,
      install: desktopRequired,
      openReleases: async () =>
        window.open("https://github.com/d0x-dev/iTune-Desktop/releases", "_blank", "noopener,noreferrer"),
      openRepository: async () =>
        window.open("https://github.com/d0x-dev/iTune-Desktop", "_blank", "noopener,noreferrer"),
      openLicense: async () =>
        window.open("https://www.gnu.org/licenses/gpl-3.0.html", "_blank", "noopener,noreferrer"),
      onDownloadProgress: () => () => {},
    },
    festival: {
      getConfig: () => fetchFestivalConfig(packageInfo.version),
    },
    news: {
      getItems: fetchDeveloperNews,
      openLink: async (value) => {
        const url = newsWebUrl(value);
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      },
    },
    auth: {
      getStatus: async () => ({ isLoggedIn: false }),
      login: desktopRequired,
      logout: desktopRequired,
      importCookie: desktopRequired,
    },
    yt: {
      getHome: async () => ({ sections: [] }),
      getSearchSuggestions: async () => ({ suggestions: [] }),
      search: desktopRequired,
      getLyrics: desktopRequired,
      getSongStream: desktopRequired,
    },
    onAuthChanged: () => () => {},
  };
}
