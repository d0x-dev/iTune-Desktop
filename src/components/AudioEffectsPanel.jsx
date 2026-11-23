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
