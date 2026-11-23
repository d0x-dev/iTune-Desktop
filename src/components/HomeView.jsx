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
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userProfile?.isLoggedIn, reload]);

  return (
    <div className="page home-page">
      <header className="page-heading">
        <h1>Home</h1>
        <p>
          {userProfile?.isLoggedIn
            ? `Made for ${userProfile.name?.split(" ")[0] || "you"}.`
            : "Discover your next favorite."}
        </p>
      </header>
      {loading ? (
        <div
          className="home-skeleton"
          aria-label="Loading recommendations"
          aria-busy="true"
        >
          <div className="skeleton-title" />
          <div className="skeleton-row">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton-card" />
            ))}
          </div>
          <div className="skeleton-title" />
          <div className="skeleton-row small">
            {[0, 1, 2, 3, 4].map((i) => (
