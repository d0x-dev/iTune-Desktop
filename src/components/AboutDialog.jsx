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
