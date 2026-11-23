import React, { useEffect, useRef, useState } from "react";
import {
  Users,
  Play,
  ArrowLeft,
  Loader2,
  SlidersHorizontal,
  Upload,
  X,
  Info,
  Star,
} from "lucide-react";
import TrackList from "./TrackList";
import Artwork from "./Artwork";
import Canvas from "./Canvas";
import MediaShelf from "./MediaShelf";
import { saveAsset, useMediaAsset } from "../utils/mediaAssets";
import { usePreferences } from "../utils/preferences";
import { useRemoteArtwork } from "../utils/remoteArtwork";
import ArtworkBackdrop from "./ArtworkBackdrop";
import AnimatedPresence from "./AnimatedPresence";
import ExplicitTitle from "./ExplicitTitle";

export default function ArtistsView({
  onSelectTrack,
  currentTrack,
  isPlaying,
  userProfile,
  onLogin,
  likedSongIds,
  onToggleLike,
  initialArtist,
  onShuffleTracks,
  onArtworkChange,
  onContextMenu,
}) {
  const [artists, setArtists] = useState([]);
  const [selectedArtist, setSelectedArtist] = useState(initialArtist || null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [showAssets, setShowAssets] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const requestId = useRef(0);
  const signature = useMediaAsset(
    selectedArtist?.id ? `artist:${selectedArtist.id}:signature` : null,
  );
  const canvas = useMediaAsset(
    selectedArtist?.id ? `artist:${selectedArtist.id}:canvas` : null,
  );
  const { preferences } = usePreferences();
  const apple = useRemoteArtwork(
    "getArtist",
    selectedArtist && detail
      ? {
          name: detail.header?.name || selectedArtist.name,
          titles: (detail.sections || []).flatMap((section) =>
            section.tracks.map((track) => track.title),
          ),
        }
      : null,
    preferences.artistArtwork,
  );
  const remoteSignature = useRemoteArtwork(
    "getSignature",
    selectedArtist && preferences.signatureUrl
      ? {
          name: detail?.header?.name || selectedArtist.name,
          baseUrl: preferences.signatureUrl,
        }
      : null,
  );
  const signatureUrl = signature || remoteSignature?.logoUrl || apple?.logoUrl;
  useEffect(() => {
    if (!selectedArtist) {
      onArtworkChange?.(null);
      return;
    }
    onArtworkChange?.({
      heroUrl:
        apple?.heroUrl || detail?.header?.thumbnail || selectedArtist.thumbnail,
      videoUrl: canvas || apple?.videoUrl,
    });
    return () => onArtworkChange?.(null);
  }, [
    selectedArtist?.id,
    apple,
    detail?.header?.thumbnail,
    canvas,
    onArtworkChange,
  ]);

  useEffect(() => {
    let active = true;
    setArtists([]);
    if (!userProfile?.isLoggedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    window.api.yt
      .getSubscribedArtists()
      .then((data) => {
        if (!active) return;
        setArtists(data?.artists || []);
        if (data?.error) setError("Your artists couldn’t load.");
      })
      .catch(() => {
        if (active) setError("Your artists couldn’t load.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userProfile?.isLoggedIn]);

  useEffect(() => {
    const revision = ++requestId.current;
    setDetail(null);
    setShowAssets(false);
    setError("");
    if (!selectedArtist?.id) return;
    setLoadingDetail(true);
    window.api.yt
      .getArtist(selectedArtist.id)
      .then((data) => {
        if (requestId.current !== revision) return;
        if (data?.error) throw new Error(data.error);
        setDetail(data);
      })
      .catch(() => {
        if (requestId.current === revision)
          setError("This artist couldn’t load. Try opening their page again.");
      })
      .finally(() => {
        if (requestId.current === revision) setLoadingDetail(false);
      });
    return () => {
      requestId.current++;
    };
  }, [selectedArtist?.id]);

  useEffect(() => {
    if (initialArtist) setSelectedArtist(initialArtist);
  }, [initialArtist]);

  const toggleSubscribe = async () => {
    if (!userProfile?.isLoggedIn) {
      onLogin();
      return;
    }
    if (subscribing) return;
    const subscribed = artists.some(
      (artist) => artist.id === selectedArtist.id,
    );
    setSubscribing(true);
    setError("");
    try {
      const result = await (subscribed
        ? window.api.yt.unsubscribeArtist(selectedArtist.id)
        : window.api.yt.subscribeArtist(selectedArtist.id));
      if (result?.error || result?.ok === false) throw new Error(result.error);
      setArtists((previous) =>
        subscribed
          ? previous.filter((artist) => artist.id !== selectedArtist.id)
          : [...previous, { ...selectedArtist, ...detail?.header }],
      );
    } catch {
      setError("Your subscription couldn’t be updated. Try again.");
    } finally {
      setSubscribing(false);
    }
  };

  const changeAsset = async (kind, file) => {
    setSaving(true);
    setError("");
    try {
      if (
        file &&
        !(
          kind === "canvas"
            ? ["video/mp4", "video/webm"]
            : ["image/png", "image/webp", "image/jpeg"]
        ).includes(file.type)
      )
        throw new Error(
          kind === "canvas"
            ? "Choose an MP4 or WebM video."
            : "Choose a PNG, WebP, or JPEG image.",
        );
      await saveAsset(`artist:${selectedArtist.id}:${kind}`, file);
    } catch (failure) {
      setError(failure.message || "This file couldn’t be saved.");
    } finally {
      setSaving(false);
    }
  };

  if (selectedArtist) {
    const name =
      detail?.header?.name || selectedArtist.name || selectedArtist.title;
    const thumbnail =
      apple?.heroUrl || detail?.header?.thumbnail || selectedArtist.thumbnail;
    const subscribed = artists.some(
      (artist) => artist.id === selectedArtist.id,
    );
    const sections = (detail?.sections || []).map((section, index) => {
      if (!/^songs$/i.test(section.title)) return section;
      const type = section.tracks[0]?.type;
      const title = type === "album" ? "Albums" : type === "video" ? "Music Videos" : type === "playlist" ? "Playlists" : type === "artist" ? "Similar Artists" : index === 0 ? "Top Songs" : "Songs";
      return { ...section, title };
    });
    const topSongs = sections.find((section) =>
      /top songs|popular|songs/i.test(section.title) && section.tracks.some((track) => track.type === "song" || track.type === "track"),
    );
    const latest = sections.find((section) =>
      /album|single|ep/i.test(section.title),
    )?.tracks?.[0];
    const songs = sections
      .flatMap((section) => section.tracks)
      .filter((track) => !["album", "playlist"].includes(track.type));
    const selectArtistTrack = (track) =>
      onSelectTrack(
        { ...track, artistId: selectedArtist.id },
        [{ ...track, artistId: selectedArtist.id }],
      );
    return (
      <div
        className="page artist-page"
        style={{ "--artist-background": apple?.background }}
      >
        <ArtworkBackdrop src={thumbnail} canvas={canvas || apple?.videoUrl} />
        <div className="artist-hero">
          <Artwork
            src={thumbnail}
            title={name}
            className="artist-hero-image"
            eager
          />
          <Canvas
            src={canvas || apple?.videoUrl || detail?.header?.canvasUrl}
          />
          <div className="artist-hero-shade" />
          <div className="artist-hero-blur" aria-hidden="true" />
          <button className="artist-back icon-button" aria-label="Back to artists" title="Back to artists" onClick={() => setSelectedArtist(null)}>
            <ArrowLeft size={23} />
          </button>
          <div className="artist-hero-content">
            {signatureUrl ? (
              <>
                <h1 className="sr-only">{name}</h1>
                <img
                  className="artist-signature"
                  src={signatureUrl}
                  alt={`${name} signature artwork`}
                />
              </>
            ) : (
              <h1>{name}</h1>
            )}
            <div className="artist-actions">
              <button
                className="artist-info icon-button"
                aria-label={`About ${name}`}
                title={`About ${name}`}
                onClick={() => document.querySelector(".artist-about")?.scrollIntoView({ behavior: "smooth" })}
              ><Info size={22} /></button>
              <button
                className="artist-play icon-button"
                aria-label={`Play ${name}`}
                title={`Play ${name}`}
                disabled={!songs.length}
                onClick={() => selectArtistTrack(songs[0], songs)}
              >
                <Play size={27} fill="currentColor" />
              </button>
              <button
                className="hero-follow icon-button"
                aria-label={subscribed ? "Unfollow artist" : "Follow artist"}
                title={subscribed ? "Unfollow artist" : "Follow artist"}
                disabled={subscribing}
                onClick={toggleSubscribe}
              >
                {subscribing ? (
                  <Loader2 size={19} className="animate-spin" />
                ) : subscribed ? (
                  <Star size={21} fill="currentColor" />
                ) : (
                  <Star size={21} />
                )}
              </button>
            </div>
          </div>
          <button
            className="artist-customize icon-button"
            aria-label="Customize artist artwork"
            title="Signature and canvas artwork"
            onClick={() => setShowAssets(!showAssets)}
            aria-expanded={showAssets}
          >
            <SlidersHorizontal size={19} />
          </button>
        </div>
        <AnimatedPresence
          show={showAssets}
          duration={220}
          className="presence-artist-assets"
        >
          <section className="artist-asset-panel">
            <div className="section-heading">
              <h2>Artist artwork</h2>
              <button
                className="icon-button"
                aria-label="Close artwork settings"
                onClick={() => setShowAssets(false)}
              >
                <X size={18} />
              </button>
            </div>
            <p>
              Add signature artwork and a looping video canvas for this artist.
              Your files are saved on this device.
            </p>
            <div className="asset-actions">
              {[
                {
                  kind: "signature",
                  label: "Signature image",
                  accept: ".png,.webp,.jpg,.jpeg",
                  present: signature,
                },
                {
                  kind: "canvas",
                  label: "Canvas video",
                  accept: ".mp4,.webm",
