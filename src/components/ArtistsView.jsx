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
