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
