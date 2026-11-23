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
