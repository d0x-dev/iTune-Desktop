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
