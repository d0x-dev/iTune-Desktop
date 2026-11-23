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
