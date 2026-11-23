import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { usePreferences } from "../utils/preferences";
import ITuneWaveIcon from "./ITuneWaveIcon";
import AnimatedPresence from "./AnimatedPresence";

const GOOGLE_LOGO = `${import.meta.env.BASE_URL}android-icons/ic_google_logo.svg`;

export default function SettingsView({
  userProfile,
  onLogin,
  onLogout,
  onOpenNews,
  onShowAbout,
}) {
  const { preferences, updatePreference } = usePreferences();
  const [signatureUrl, setSignatureUrl] = useState(preferences.signatureUrl);
  const [error, setError] = useState("");
  const [aiConfig, setAiConfig] = useState({
    provider: "builtin",
    model: "",
    baseUrl: "",
    apiKey: "",
    hasKey: false,
  });
  const [aiStatus, setAiStatus] = useState("");
  useEffect(() => {
    window.api.settings
      .getAITranslation()
      .then((config) => setAiConfig((current) => ({ ...current, ...config })))
      .catch(() => {});
  }, []);
  const setDesktopTransparency = (value) => {
    updatePreference("desktopTransparency", value);
    if (value) {
      updatePreference("glass", false);
      updatePreference("backgroundArtwork", false);
    }
  };
  const saveSignature = (event) => {
    event.preventDefault();
    const value = signatureUrl.trim().replace(/\/$/, "");
    if (value && !/^https?:\/\//.test(value)) {
      setError("Enter an HTTP or HTTPS address.");
      return;
    }
    updatePreference("signatureUrl", value);
    setError("");
  };
  const saveAITranslation = async (event) => {
    event.preventDefault();
    setAiStatus("Saving…");
    const result = await window.api.settings.saveAITranslation(aiConfig);
    if (!result?.ok) {
      setAiStatus(result?.error || "The AI settings couldn’t be saved.");
      return;
    }
    setAiConfig((current) => ({
      ...current,
      ...result,
      apiKey: "",
    }));
    setAiStatus("Saved securely with your system key store.");
  };
  return (
    <div className="page settings-page">
      <header className="page-heading settings-heading">
        <span className="settings-app-mark"><ITuneWaveIcon size={32} /></span>
        <div>
          <h1>Settings</h1>
          <p>Personalize iTune across appearance, lyrics, and playback.</p>
        </div>
      </header>
      <section className="settings-profile-card">
        {userProfile?.photo ? (
          <img src={userProfile.photo} alt="" />
        ) : (
          <span className="settings-profile-avatar">
            {(userProfile?.name || "L").slice(0, 1).toUpperCase()}
          </span>
        )}
        <div>
          <strong>{userProfile?.name || "Listener"}</strong>
          <p>
            {userProfile?.isLoggedIn
              ? "Google and YouTube Music connected"
              : "Your local iTune profile"}
          </p>
        </div>
        <button
          className="secondary-button"
          onClick={userProfile?.isLoggedIn ? onLogout : onLogin}
        >
          {!userProfile?.isLoggedIn && (
            <img className="inline-google-logo" src={GOOGLE_LOGO} alt="" />
          )}
          {userProfile?.isLoggedIn ? "Sign Out" : "Continue with Google"}
        </button>
      </section>
      <section className="settings-section">
        <h2>Updates</h2>
        <Setting title="News from dev" description="Announcements, releases and changelog.">
          <button className="secondary-button" onClick={onOpenNews}>Open News</button>
        </Setting>
      </section>
      <section className="settings-section">
        <h2>Appearance</h2>
        <Setting title="Appearance" description="Choose how iTune looks.">
          <GlassSelect
            label="Appearance"
            value={preferences.theme}
            onChange={(value) => updatePreference("theme", value)}
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </Setting>
        <Setting
          title="Desktop Transparency"
          description="Use translucent app panels where your desktop compositor supports transparency."
        >
          <Toggle
            label="Desktop Transparency"
            value={preferences.desktopTransparency}
            onChange={setDesktopTransparency}
          />
        </Setting>
        <Setting
          title="Liquid Glass"
          description="Use translucent app panels without showing the desktop behind the window."
        >
          <Toggle
            label="Liquid Glass"
            value={preferences.glass}
            disabled={preferences.desktopTransparency}
            onChange={(value) => updatePreference("glass", value)}
          />
        </Setting>
        <Setting
          title="Artwork Background"
          description="Add a light blurred artwork tint over the transparent desktop background."
        >
          <Toggle
            label="Artwork Background"
            value={preferences.backgroundArtwork}
            disabled={preferences.desktopTransparency}
            onChange={(value) => updatePreference("backgroundArtwork", value)}
          />
        </Setting>
        <Setting
          title="Home Top Cards"
          description="Choose the same top-card layout used by iTune on Android."
        >
          <GlassSelect
            label="Home Top Cards"
            value={preferences.homeHeroStyle}
            onChange={(value) => updatePreference("homeHeroStyle", value)}
            options={[
              { value: "apple", label: "Apple" },
              { value: "portrait", label: "Portrait" },
              { value: "landscape", label: "Landscape" },
            ]}
          />
        </Setting>
        <Setting
          title="Animated Artwork"
          description="Play artist and album motion artwork when available."
        >
          <Toggle
            label="Animated Artwork"
            value={preferences.motion}
            onChange={(value) => updatePreference("motion", value)}
          />
        </Setting>
        <Setting
          title="Splash Screen"
          description="Play the Android iTune typing and travelling-logo intro when iTune starts."
        >
          <Toggle
            label="Splash Screen"
            value={preferences.splashScreenEnabled}
            onChange={(value) => updatePreference("splashScreenEnabled", value)}
          />
        </Setting>
        <Setting
          title="Collection Atmosphere"
          description="Spread artist, album, and playlist artwork color and motion across the full app."
        >
          <Toggle
            label="Collection Atmosphere"
            value={preferences.collectionVisualEffects}
            onChange={(value) =>
              updatePreference("collectionVisualEffects", value)
            }
          />
        </Setting>
        <Setting title="Player Position">
          <GlassSelect
            label="Player Position"
            value={preferences.playerPlacement}
            onChange={(value) => updatePreference("playerPlacement", value)}
            options={[
              { value: "top", label: "Top Bar" },
              { value: "floating", label: "Floating Player" },
            ]}
          />
        </Setting>
      </section>
      <section className="settings-section">
        <h2>Artists & Lyrics</h2>
        <Setting
          title="Apple Artist Artwork"
          description="Look up matching artist photos, signature logos, and motion artwork."
        >
          <Toggle
            label="Apple Artist Artwork"
