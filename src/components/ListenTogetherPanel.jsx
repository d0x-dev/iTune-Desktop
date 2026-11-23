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
              </button>
              {localIp && <p className="listen-lan-hint">This PC · {localIp}:8765</p>}
              <div className="listen-divider"><span>nearby AirBeats / iShare hosts</span></div>
              <button className="listen-scan" disabled={scanningLan} onClick={onScanLan}>
                <RefreshCw size={15} className={scanningLan ? "animate-spin" : ""} />
                {scanningLan ? "Scanning Wi-Fi…" : "Scan Nearby Devices"}
              </button>
              {lanHosts?.length > 0 && (
                <div className="listen-lan-hosts">
                  {lanHosts.map((host) => (
                    <button key={host.address} onClick={() => onJoinLan(host.address, name.trim())}>
                      <Wifi size={16} />
                      <span><strong>{host.hostName}</strong><small>{host.address} · {host.participants} connected</small></span>
                    </button>
                  ))}
                </div>
              )}
              <div className="listen-code-entry">
                <input
                  aria-label="LAN host address"
                  value={lanAddress}
                  placeholder="192.168.1.10:8765"
                  onChange={(event) => setLanAddress(event.target.value)}
                />
                <button disabled={busy || !name.trim() || !lanAddress.trim()} onClick={() => onJoinLan(lanAddress, name.trim())}>
                  Join
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="listen-together-session">
          <div className="listen-session-code">
            <small>{connectionMode === "lan" ? "LAN Host Address" : "Pairing Code"}</small>
            <strong className={connectionMode === "lan" ? "lan-address" : ""}>{session.code}</strong>
            <button className="icon-button" aria-label="Copy pairing code" onClick={copyCode}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <p className="listen-status">
            <span /> {role === "host" ? "Hosting" : "Listening"} on {connectionMode === "lan" ? "local Wi-Fi" : "online"} · {session.participants || session.participantList?.length || 1} connected
          </p>
          <div className="listen-participants">
            {(session.participantList || []).map((participant) => (
              <div key={participant.id || participant.name}>
                <span>{String(participant.name || "L").slice(0, 1).toUpperCase()}</span>
                <p><strong>{participant.name || "iShare Listener"}</strong><small>{participant.isHost ? "Host" : "Listener"}</small></p>
              </div>
            ))}
          </div>
          {role === "host" && (
            <div className="listen-permissions">
              <label>
                <span><strong>Guest playback controls</strong><small>Allow play, pause, and seeking</small></span>
                <input type="checkbox" checked={settings.allowGuestsToControlPlayback} onChange={(event) => onSettingsChange({ ...settings, allowGuestsToControlPlayback: event.target.checked })} />
              </label>
              <label>
                <span><strong>Guest queue additions</strong><small>Allow listeners to add songs</small></span>
                <input type="checkbox" checked={settings.allowGuestsToAddTracks} onChange={(event) => onSettingsChange({ ...settings, allowGuestsToAddTracks: event.target.checked })} />
              </label>
            </div>
          )}
          <button className="listen-leave" disabled={busy} onClick={onLeave}>
            <LogOut size={15} /> Leave Session
          </button>
        </div>
      )}
      {error && <p className="listen-error">{error}</p>}
    </aside>
  );
}
