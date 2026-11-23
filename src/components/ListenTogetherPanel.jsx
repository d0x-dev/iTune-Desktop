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
