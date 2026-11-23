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
            value={preferences.artistArtwork}
            onChange={(value) => updatePreference("artistArtwork", value)}
          />
        </Setting>
        <Setting title="Lyrics Provider">
          <GlassSelect
            label="Lyrics Provider"
            value={preferences.lyricsProvider}
            onChange={(value) => updatePreference("lyricsProvider", value)}
            options={[
              { value: "auto", label: "Automatic" },
              { value: "lrclib", label: "LRC Lib · Synced & Plain" },
              { value: "kugou", label: "KuGou" },
              { value: "simpmusic", label: "SimpMusic · YouTube ID" },
              { value: "youtube_subtitles", label: "YouTube Subtitles / CC" },
              { value: "paxsenix", label: "Paxsenix · Multi-source" },
              { value: "unison", label: "Unison" },
              { value: "betterlyrics", label: "BetterLyrics · TTML / Word Timing" },
              { value: "portato", label: "Portato" },
              { value: "youly", label: "YouLy · TTML / LRC Mirrors" },
              { value: "megalobiz", label: "Megalobiz" },
              { value: "youtube_music", label: "YouTube Music" },
              { value: "spotify", label: "Spotify via Paxsenix" },
              { value: "apple_music", label: "Apple Music via Paxsenix" },
              { value: "musixmatch", label: "Musixmatch via Paxsenix" },
              { value: "netease", label: "NetEase via Paxsenix" },
              { value: "genius", label: "Genius · Plain Lyrics" },
              { value: "lyricsovh", label: "Lyrics.ovh · Plain Lyrics" },
            ]}
          />
        </Setting>
        <Setting
          title="Translate Lyrics"
          description="Show a translated line below every original lyric."
        >
          <Toggle
            label="Translate Lyrics"
            value={preferences.lyricsTranslation}
            onChange={(value) => updatePreference("lyricsTranslation", value)}
          />
        </Setting>
        <Setting title="Translation Language">
          <GlassSelect
            label="Lyrics translation language"
            value={preferences.translationLanguage}
            disabled={!preferences.lyricsTranslation}
            onChange={(value) => updatePreference("translationLanguage", value)}
            options={[
              { value: "hi", label: "Hindi" },
              { value: "en", label: "English" },
              { value: "es", label: "Spanish" },
              { value: "fr", label: "French" },
              { value: "de", label: "German" },
              { value: "pt", label: "Portuguese" },
              { value: "ja", label: "Japanese" },
              { value: "ko", label: "Korean" },
              { value: "ar", label: "Arabic" },
              { value: "bn", label: "Bengali" },
              { value: "pa", label: "Punjabi" },
              { value: "ta", label: "Tamil" },
              { value: "te", label: "Telugu" },
              { value: "ur", label: "Urdu" },
            ]}
          />
        </Setting>
        <Setting title="Translation Style">
          <GlassSelect
            label="Lyrics translation style"
            value={preferences.translationMode}
            disabled={!preferences.lyricsTranslation}
            onChange={(value) => updatePreference("translationMode", value)}
            options={[
              { value: "literal", label: "Poetic Translation" },
              { value: "hinglish", label: "Hinglish · Latin Alphabet" },
              { value: "romanized", label: "Romanized / Transliteration" },
            ]}
          />
        </Setting>
        <form className="signature-settings ai-provider-settings" onSubmit={saveAITranslation}>
          <label>AI Lyrics Translation</label>
          <p>
            Choose the provider here. API keys use your system secure storage and are
            never stored in browser preferences.
          </p>
          <div className="ai-settings-grid">
            <GlassSelect
              label="AI translation provider"
              value={aiConfig.provider}
              onChange={(value) =>
                setAiConfig((current) => ({
                  ...current,
                  provider: value,
                  model: "",
                  baseUrl: "",
                }))
              }
              options={[
                { value: "builtin", label: "Built-in · No API Key" },
                { value: "openrouter", label: "OpenRouter" },
                { value: "gemini", label: "Google Gemini" },
                { value: "openai", label: "OpenAI / ChatGPT" },
                { value: "claude", label: "Claude / Anthropic" },
                { value: "custom", label: "Custom OpenAI-Compatible" },
              ]}
            />
            {aiConfig.provider !== "builtin" && (
              <>
                <input
                  type="password"
                  aria-label="AI API key"
                  value={aiConfig.apiKey}
                  onChange={(event) =>
                    setAiConfig((current) => ({
                      ...current,
                      apiKey: event.target.value,
                    }))
                  }
                  placeholder={
                    aiConfig.hasKey ? "API key saved · enter to replace" : "API key"
                  }
                  autoComplete="off"
                />
                <input
                  aria-label="AI model"
                  value={aiConfig.model}
                  onChange={(event) =>
                    setAiConfig((current) => ({
                      ...current,
                      model: event.target.value,
                    }))
                  }
                  placeholder="Model · leave blank for recommended"
                />
                <input
                  aria-label="AI base URL"
                  value={aiConfig.baseUrl}
                  onChange={(event) =>
                    setAiConfig((current) => ({
                      ...current,
                      baseUrl: event.target.value,
                    }))
                  }
                  placeholder="Base URL · optional"
                />
              </>
            )}
            <button className="secondary-button">Save AI Settings</button>
          </div>
          {aiStatus && <p className="settings-status">{aiStatus}</p>}
        </form>
        <form className="signature-settings" onSubmit={saveSignature}>
          <label htmlFor="signature-service">Signature Service</label>
          <p>
            Use the same signature service address configured in your Android
            app.
          </p>
          <div>
            <input
              id="signature-service"
              value={signatureUrl}
              onChange={(event) => setSignatureUrl(event.target.value)}
              placeholder="https://your-signature-service"
            />
            <button className="secondary-button">Save</button>
          </div>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
        </form>
      </section>
      <section className="settings-section">
        <h2>Playback & Downloads</h2>
        <Setting
          title="Audio Effects Engine"
          description="Process music through the desktop Web Audio engine. Live radio stays direct for compatibility."
        >
          <Toggle
            label="Audio Effects Engine"
            value={preferences.audioEffectsEnabled}
            onChange={(value) => updatePreference("audioEffectsEnabled", value)}
          />
        </Setting>
        <Setting
          title="Dolby Atmos-style Spatializer"
          description="A real virtual surround stage using stereo delay taps and room reflections; it does not decode licensed Dolby Atmos tracks."
        >
          <Toggle
            label="Dolby Atmos-style Spatializer"
            value={preferences.virtualAtmos}
            disabled={!preferences.audioEffectsEnabled}
            onChange={(value) => updatePreference("virtualAtmos", value)}
          />
        </Setting>
        <Setting title="Sound Preset" description="Apply a working equalizer curve.">
          <GlassSelect
            label="Audio preset"
            value={preferences.audioPreset}
            disabled={!preferences.audioEffectsEnabled}
            onChange={(value) => updatePreference("audioPreset", value)}
            options={[
              { value: "balanced", label: "Balanced" },
              { value: "bass", label: "Bass Boost" },
              { value: "vocal", label: "Vocal Clarity" },
              { value: "bright", label: "Bright Detail" },
              { value: "night", label: "Night Listening" },
            ]}
          />
        </Setting>
        <Setting title="Spatial Width" description={`${Math.round(preferences.spatialWidth * 100)}%`}>
          <input
            className="settings-range"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={preferences.spatialWidth}
            style={{ "--progress": `${preferences.spatialWidth * 100}%` }}
            disabled={!preferences.audioEffectsEnabled || !preferences.virtualAtmos}
            onChange={(event) => updatePreference("spatialWidth", Number(event.target.value))}
          />
        </Setting>
        <Setting title="Bass" description={`${preferences.bassBoost > 0 ? "+" : ""}${preferences.bassBoost} dB`}>
          <input
            className="settings-range"
            type="range"
            min="-6"
            max="12"
            step="1"
            value={preferences.bassBoost}
            style={{ "--progress": `${((preferences.bassBoost + 6) / 18) * 100}%` }}
            disabled={!preferences.audioEffectsEnabled}
            onChange={(event) => updatePreference("bassBoost", Number(event.target.value))}
          />
        </Setting>
        <Setting title="Treble" description={`${preferences.trebleBoost > 0 ? "+" : ""}${preferences.trebleBoost} dB`}>
          <input
            className="settings-range"
            type="range"
            min="-6"
            max="10"
            step="1"
            value={preferences.trebleBoost}
            style={{ "--progress": `${((preferences.trebleBoost + 6) / 16) * 100}%` }}
            disabled={!preferences.audioEffectsEnabled}
            onChange={(event) => updatePreference("trebleBoost", Number(event.target.value))}
          />
        </Setting>
        <Setting title="Room Reverb" description={`${Math.round(preferences.reverbAmount * 100)}%`}>
          <input
            className="settings-range"
            type="range"
            min="0"
            max="0.55"
            step="0.01"
            value={preferences.reverbAmount}
            style={{ "--progress": `${(preferences.reverbAmount / 0.55) * 100}%` }}
            disabled={!preferences.audioEffectsEnabled}
            onChange={(event) => updatePreference("reverbAmount", Number(event.target.value))}
          />
        </Setting>
        <Setting
          title="Loudness Normalization"
          description="Use dynamic compression to keep quiet and loud songs closer in level."
        >
          <Toggle
            label="Loudness Normalization"
            value={preferences.loudnessNormalization}
            disabled={!preferences.audioEffectsEnabled}
            onChange={(value) => updatePreference("loudnessNormalization", value)}
          />
        </Setting>
        <Setting
          title="YouTube Listening History"
          description="Report songs after 15 seconds of real playback so they appear in your YouTube account history."
        >
          <Toggle
            label="YouTube Listening History"
            value={preferences.playbackHistorySync}
            onChange={(value) => updatePreference("playbackHistorySync", value)}
          />
        </Setting>
        <Setting
          title="Continue Playing"
          description="Automatically move to the next item in the current queue."
        >
          <Toggle
            label="Continue Playing"
            value={preferences.autoplay}
            onChange={(value) => updatePreference("autoplay", value)}
          />
        </Setting>
        <Setting
          title="Crossfade"
          description="Blend the ending of one song into the next using two preloaded audio decks and an equal-power fade."
        >
          <Toggle
            label="Crossfade"
            value={preferences.crossfadeEnabled}
            onChange={(value) => updatePreference("crossfadeEnabled", value)}
          />
        </Setting>
        <Setting
          title="Crossfade Duration"
          description={`${preferences.crossfadeDuration} seconds`}
        >
          <input
            className="settings-range"
            type="range"
            min="1"
            max="12"
            step="1"
            value={preferences.crossfadeDuration}
            style={{ "--progress": `${((preferences.crossfadeDuration - 1) / 11) * 100}%` }}
            disabled={!preferences.crossfadeEnabled}
            onChange={(event) =>
              updatePreference("crossfadeDuration", Number(event.target.value))
            }
          />
        </Setting>
        <Setting
          title="Download Quality"
          description="Songs are saved to your Music/iTune folder."
        >
          <GlassSelect
            label="Download quality"
            value={preferences.downloadQuality}
            onChange={(value) => updatePreference("downloadQuality", value)}
            options={[
              { value: "best", label: "Best Available" },
              { value: "data-saver", label: "Data Saver" },
            ]}
          />
        </Setting>
      </section>
      <section className="settings-section settings-about-section">
        <h2>General</h2>
        <Setting
          title="General & About"
          description="Build details, release notes, and iTune updates."
        >
          <button className="secondary-button" onClick={onShowAbout}>
            About
          </button>
        </Setting>
      </section>
    </div>
  );
}
function Setting({ title, description, children }) {
  return (
    <div className="setting-row">
      <div>
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
function Toggle({ label, value, disabled = false, onChange }) {
  return (
    <button
      className={`setting-toggle ${value ? "enabled" : ""}`}
      role="switch"
      aria-label={label}
      aria-checked={value}
      disabled={disabled}
      onClick={() => onChange(!value)}
    >
      <span />
    </button>
  );
}

function GlassSelect({ label, value, options, disabled = false, onChange }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const selected = options.find((option) => option.value === value) || options[0];
  return (
    <div className={`glass-select ${open ? "open" : ""}`} ref={root}>
      <button
        type="button"
        className="glass-select-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((shown) => !shown)}
      >
        <span>{selected?.label}</span>
        <ChevronDown size={15} />
      </button>
      <AnimatedPresence
        show={open}
        duration={180}
        className="presence-select-menu"
      >
        <div className="glass-select-menu no-scrollbar" role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={option.value === value ? "selected" : ""}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span>{option.label}</span>
              {option.value === value && <Check size={15} />}
            </button>
          ))}
        </div>
      </AnimatedPresence>
    </div>
  );
}
