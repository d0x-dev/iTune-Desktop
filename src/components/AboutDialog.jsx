import React, { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  ExternalLink,
  LoaderCircle,
  X,
} from "lucide-react";
import AnimatedPresence from "./AnimatedPresence";
import ITuneWaveIcon from "./ITuneWaveIcon";

function formatSize(bytes) {
  if (!bytes) return "Size unavailable";
  const megabytes = bytes / 1024 / 1024;
  return `${megabytes >= 100 ? megabytes.toFixed(0) : megabytes.toFixed(1)} MB`;
}

function AboutInfoLine({ label, value }) {
  return (
    <div className="about-info-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ReleaseNotes({ notes }) {
  return <p className="about-release-notes">{notes || "No release notes were published."}</p>;
}

export default function AboutDialog({
  show,
  onClose,
  updateResult,
  downloadProgress,
  onCheckUpdates,
}) {
  const [info, setInfo] = useState(null);
  const [checking, setChecking] = useState(false);
  const [busyAsset, setBusyAsset] = useState("");
  const [downloadedAssets, setDownloadedAssets] = useState(() => new Set());
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!show) return;
    window.api.updates.getInfo().then(setInfo).catch(() => {});
  }, [show]);

  const checkForUpdates = async () => {
    setChecking(true);
    setMessage("");
    try {
      const result = await onCheckUpdates();
      setMessage(result?.downloadError || result?.error || "");
    } finally {
      setChecking(false);
    }
  };

  const downloadAsset = async (release, asset) => {
    setBusyAsset(asset.name);
    setMessage("");
    try {
      const result = await window.api.updates.download(release.tag, asset.name);
      if (!result?.ok) {
        setMessage(result?.error || "The download could not be completed.");
        return;
      }
      setDownloadedAssets((current) => new Set(current).add(asset.name));
    } finally {
      setBusyAsset("");
    }
  };

  const openDownloaded = async (asset) => {
    const result = await window.api.updates.install(asset.name);
    if (!result?.ok) setMessage(result?.error || "The file could not be opened.");
  };

  const releases = updateResult?.releases || [];
  const latest = updateResult?.latestRelease;
  const downloadPercent = downloadProgress?.totalBytes
    ? Math.round(downloadProgress.downloadedBytes / downloadProgress.totalBytes * 100)
    : null;

  return (
    <AnimatedPresence show={show} duration={230} className="presence-modal">
      <div
        className="modal-backdrop about-backdrop"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <section className="about-dialog" role="dialog" aria-modal="true" aria-labelledby="about-title">
          <button className="about-close" type="button" aria-label="Close About" onClick={onClose}>
            <X size={17} />
          </button>
          <header className="about-header">
            <span className="about-app-icon"><ITuneWaveIcon size={32} /></span>
            <h2 id="about-title">iTune</h2>
            <div className="about-build-card">
              <AboutInfoLine label="Version" value={info?.version || "Loading…"} />
              <AboutInfoLine label="Platform" value={info ? `${info.platform} · ${info.architecture}` : "—"} />
              <AboutInfoLine label="Electron" value={info?.electron || "—"} />
              <AboutInfoLine label="Chromium" value={info?.chromium || "—"} />
              <AboutInfoLine label="Latest on GitHub" value={latest?.tag || (checking ? "Checking…" : "No release found")} />
              <AboutInfoLine label="Release codename" value={latest?.name || "Not published"} />
              <AboutInfoLine
                label="Last update"
                value={latest?.publishedAt ? new Date(latest.publishedAt).toLocaleDateString() : "—"}
              />
              <AboutInfoLine
                label="Status"
                value={updateResult?.updateAvailable ? "Update available" : checking ? "Checking" : latest ? "Up to date" : "Release unavailable"}
              />
            </div>
          </header>

          <div className="about-update-area">
            {latest && updateResult?.updateAvailable ? (
              <section className="about-update-card">
                <div className="about-update-title">
                  <span>What’s New</span>
                  <strong>{latest.name}</strong>
                </div>
                <ReleaseNotes notes={latest.notes} />
                {downloadProgress ? (
                  <div className="about-download-progress" role="status">
                    <span>Downloading {downloadProgress.assetName}</span>
                    {downloadPercent == null ? (
                      <LoaderCircle className="about-spin" size={17} />
                    ) : <span>{downloadPercent}%</span>}
                    <progress max={downloadProgress.totalBytes || undefined} value={downloadProgress.totalBytes ? downloadProgress.downloadedBytes : undefined} />
                  </div>
                ) : updateResult.downloadedAsset ? (
                  <button className="about-primary-action" type="button" onClick={() => openDownloaded({ name: updateResult.downloadedAsset })}>
                    Install iTune {latest.tag}
                  </button>
                ) : updateResult.downloadUnavailable || updateResult.downloadError ? (
                  <button className="about-primary-action" type="button" onClick={() => window.api.updates.openReleases()}>
                    View iTune {latest.tag} Release <ArrowUpRight size={15} />
                  </button>
                ) : (
                  <div className="about-download-progress" role="status">
                    <span>Preparing update download…</span>
                    <LoaderCircle className="about-spin" size={17} />
                  </div>
                )}
              </section>
            ) : (
              <button
                className="about-primary-action"
                type="button"
                onClick={latest ? () => window.api.updates.openReleases() : checkForUpdates}
                disabled={checking}
              >
                {checking ? <LoaderCircle className="about-spin" size={16} /> : <ArrowDownToLine size={16} />}
                {latest ? "View GitHub Release" : checking ? "Checking GitHub…" : "Check for Updates"}
              </button>
            )}
            {message && <p className="about-status" role="status">{message}</p>}
          </div>

          <details className="about-downloads">
            <summary>
              <span>Available downloads</span>
              <ArrowUpRight size={15} />
            </summary>
            <div className="about-release-list">
              {releases.length ? releases.map((release) => (
                <details className="about-release" key={release.tag}>
                  <summary>
                    <span><strong>{release.name}</strong><small>{release.tag}{release.publishedAt ? ` · ${new Date(release.publishedAt).toLocaleDateString()}` : ""}</small></span>
                    <ArrowUpRight size={14} />
                  </summary>
                  <ReleaseNotes notes={release.notes} />
                  <div className="about-asset-list">
                    {release.assets.length ? release.assets.map((asset) => {
                      const downloading = busyAsset === asset.name;
                      const downloaded = downloadedAssets.has(asset.name) || updateResult?.downloadedAsset === asset.name;
                      return (
                        <div className="about-asset" key={asset.name}>
                          <div><strong>{asset.name}</strong><small>{formatSize(asset.size)}</small></div>
                          {downloaded ? (
