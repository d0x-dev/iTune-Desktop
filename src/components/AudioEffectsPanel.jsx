import React from "react";
import { AudioWaveform, Sparkles, X } from "lucide-react";
import { usePreferences } from "../utils/preferences";

export default function AudioEffectsPanel({ onClose, radioMode = false }) {
  const { preferences, updatePreference } = usePreferences();
  const set = (key, value) => updatePreference(key, value);
  return (
    <section className="audio-effects-panel" aria-label="Audio effects">
      <header>
        <div>
          <AudioWaveform size={18} />
          <span>Audio Effects</span>
        </div>
        <button className="icon-button" aria-label="Close audio effects" onClick={onClose}>
          <X size={17} />
        </button>
      </header>
      {radioMode && (
        <p className="audio-effects-notice">
          Live radio uses direct playback for maximum station compatibility.
        </p>
      )}
      <label className="audio-effect-toggle">
        <span>
          <strong>Effects Engine</strong>
          <small>Real-time Web Audio processing</small>
        </span>
        <input
          type="checkbox"
          checked={preferences.audioEffectsEnabled}
          disabled={radioMode}
          onChange={(event) => set("audioEffectsEnabled", event.target.checked)}
        />
      </label>
      <label className="audio-effect-toggle">
        <span>
          <strong>Virtual Atmos</strong>
          <small>Stereo spatial stage and reflections</small>
        </span>
        <input
          type="checkbox"
          checked={preferences.virtualAtmos}
          disabled={!preferences.audioEffectsEnabled || radioMode}
          onChange={(event) => set("virtualAtmos", event.target.checked)}
        />
      </label>
      <div className="audio-preset-row">
        {["balanced", "bass", "vocal", "bright", "night"].map((preset) => (
          <button
            key={preset}
            className={preferences.audioPreset === preset ? "selected" : ""}
            disabled={!preferences.audioEffectsEnabled || radioMode}
            onClick={() => set("audioPreset", preset)}
          >
            {preset[0].toUpperCase() + preset.slice(1)}
          </button>
        ))}
      </div>
      <EffectRange
        label="Spatial Width"
        value={preferences.spatialWidth}
        min={0}
        max={1}
