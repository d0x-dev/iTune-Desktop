import React, { useEffect, useState } from "react";
import { RefreshCw, Headphones } from "lucide-react";
import MediaShelf from "./MediaShelf";

export default function HomeView({
  onSelectTrack,
  userProfile,
  onLogin,
  onNavigate,
}) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    window.api.yt
      .getHome()
      .then((data) => {
        if (!active) return;
        setSections(
          (data?.sections || []).filter((section) => section.contents?.length),
        );
        if (data?.error)
          setError("Your recommendations couldn’t load. Try again.");
      })
      .catch(() => {
        if (active) setError("Your recommendations couldn’t load. Try again.");
      })
