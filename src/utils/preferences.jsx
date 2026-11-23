import React, { createContext, useContext, useEffect, useState } from "react";

const defaults = {
  theme: "dark",
  desktopTransparency: true,
  glass: false,
  backgroundArtwork: false,
  motion: true,
  splashScreenEnabled: true,
  artistArtwork: true,
  homeHeroStyle: "apple",
  signatureUrl: "",
  lyricsProvider: "auto",
  lyricsTranslation: false,
  translationLanguage: "hi",
  translationMode: "literal",
  playbackHistorySync: true,
  downloadQuality: "best",
  autoplay: true,
  crossfadeEnabled: false,
  crossfadeDuration: 5,
  explicitContent: true,
  collectionVisualEffects: true,
  audioEffectsEnabled: false,
  audioPreset: "balanced",
  virtualAtmos: false,
  spatialWidth: 0.35,
  bassBoost: 0,
  trebleBoost: 0,
  reverbAmount: 0,
  loudnessNormalization: true,
  playerPlacement: "top",
};
const PreferencesContext = createContext({
  preferences: defaults,
  updatePreference: () => {},
});
export function PreferencesProvider({ children }) {
  const [preferences, setPreferences] = useState(() => {
    try {
      const loaded = {
        ...defaults,
        ...JSON.parse(localStorage.getItem("itune-preferences") || "{}"),
      };
      if (loaded.desktopTransparency) {
        loaded.glass = false;
        loaded.backgroundArtwork = false;
      }
      return loaded;
    } catch {
      return defaults;
    }
  });
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const theme =
        preferences.theme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : preferences.theme;
      document.documentElement.dataset.theme = theme;
      document.documentElement.dataset.acrylic = String(
        preferences.desktopTransparency,
      );
      document.documentElement.dataset.glass = String(
        preferences.desktopTransparency || preferences.glass,
      );
      document.documentElement.dataset.motion = String(preferences.motion);
      document.documentElement.dataset.playerPlacement =
        preferences.playerPlacement;
      document.documentElement.dataset.collectionEffects = String(
        preferences.collectionVisualEffects,
      );
      window.api.window?.setAppearance?.(
        theme,
        preferences.desktopTransparency,
      );
    };
    apply();
    media.addEventListener("change", apply);
    try {
      localStorage.setItem("itune-preferences", JSON.stringify(preferences));
    } catch {}
    return () => media.removeEventListener("change", apply);
  }, [preferences]);
  const updatePreference = (key, value) =>
    setPreferences((previous) => ({ ...previous, [key]: value }));
  return (
    <PreferencesContext.Provider value={{ preferences, updatePreference }}>
      {children}
    </PreferencesContext.Provider>
  );
}
export const usePreferences = () => useContext(PreferencesContext);
