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
        step={0.01}
        display={`${Math.round(preferences.spatialWidth * 100)}%`}
        disabled={!preferences.audioEffectsEnabled || !preferences.virtualAtmos || radioMode}
        onChange={(value) => set("spatialWidth", value)}
      />
      <EffectRange
        label="Bass"
        value={preferences.bassBoost}
        min={-6}
        max={12}
        step={1}
        display={`${preferences.bassBoost > 0 ? "+" : ""}${preferences.bassBoost} dB`}
        disabled={!preferences.audioEffectsEnabled || radioMode}
        onChange={(value) => set("bassBoost", value)}
      />
      <EffectRange
        label="Treble"
        value={preferences.trebleBoost}
        min={-6}
        max={10}
        step={1}
        display={`${preferences.trebleBoost > 0 ? "+" : ""}${preferences.trebleBoost} dB`}
        disabled={!preferences.audioEffectsEnabled || radioMode}
        onChange={(value) => set("trebleBoost", value)}
      />
      <EffectRange
        label="Room"
        value={preferences.reverbAmount}
        min={0}
        max={0.55}
        step={0.01}
        display={`${Math.round(preferences.reverbAmount * 100)}%`}
        disabled={!preferences.audioEffectsEnabled || radioMode}
        onChange={(value) => set("reverbAmount", value)}
      />
      <div className="audio-engine-badge">
        <Sparkles size={13} />
        {preferences.virtualAtmos && preferences.audioEffectsEnabled
          ? "Virtual Atmos active"
          : preferences.audioEffectsEnabled
            ? `${preferences.audioPreset} EQ active`
            : "Direct sound"}
      </div>
    </section>
  );
}

function EffectRange({ label, display, onChange, ...props }) {
  const progress =
    ((Number(props.value) - Number(props.min)) /
      Math.max(0.0001, Number(props.max) - Number(props.min))) *
    100;
  return (
    <label className="audio-effect-range">
      <span><strong>{label}</strong><small>{display}</small></span>
      <input
        className="apple-seekbar"
        type="range"
        {...props}
        style={{ "--progress": `${progress}%` }}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
