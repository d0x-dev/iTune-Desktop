import React, { useEffect, useState } from "react";
import {
  Check,
  Cloud,
  Copy,
  Loader2,
  LogOut,
  Radio,
  RefreshCw,
  Wifi,
  X,
} from "lucide-react";
import AndroidIcon from "./AndroidIcon";

export default function ListenTogetherPanel({
  session,
  role,
  connectionMode,
  displayName,
  settings,
  error,
  busy,
  onCreate,
  onJoin,
  onHostLan,
  onJoinLan,
  onScanLan,
  lanHosts,
  scanningLan,
  localIp,
  onLeave,
  onSettingsChange,
  onClose,
}) {
  const [name, setName] = useState(displayName || "iTune Listener");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState("online");
  const [lanAddress, setLanAddress] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => setName(displayName || "iTune Listener"), [displayName]);

  const copyCode = async () => {
    await navigator.clipboard.writeText(session?.code || "").catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <aside className="listen-together-panel" aria-label="Listen Together">
      <div className="listen-together-heading">
        <span className="listen-together-icon">
          <AndroidIcon name="ic_ishare" size={22} />
        </span>
        <div>
          <strong>Listen Together</strong>
          <small>iShare · AirBeats compatible</small>
        </div>
        <button className="icon-button" aria-label="Close Listen Together" onClick={onClose}>
          <X size={17} />
        </button>
      </div>

      {!session ? (
        <div className="listen-together-setup">
          <div className="listen-mode-tabs">
            <button
              className={mode === "online" ? "selected" : ""}
              onClick={() => setMode("online")}
            >
              <Cloud size={15} /> Online
            </button>
            <button
              className={mode === "lan" ? "selected" : ""}
              onClick={() => setMode("lan")}
            >
              <Wifi size={15} /> Local Wi-Fi
            </button>
          </div>
          <label>
            <span>Your Name</span>
            <input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} />
          </label>
          {mode === "online" ? (
            <>
              <button className="listen-primary" disabled={busy || !name.trim()} onClick={() => onCreate(name.trim())}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Radio size={16} />}
                Host an Online Session
              </button>
              <div className="listen-divider"><span>or join with a code</span></div>
              <div className="listen-code-entry">
                <input
                  aria-label="Pairing code"
                  value={code}
                  maxLength={12}
                  placeholder="PAIRING CODE"
                  onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
                />
                <button disabled={busy || !name.trim() || !code.trim()} onClick={() => onJoin(code, name.trim())}>
                  Join
                </button>
              </div>
            </>
          ) : (
            <>
              <button className="listen-primary" disabled={busy || !name.trim()} onClick={() => onHostLan(name.trim())}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Wifi size={16} />}
                Host on Local Wi-Fi
