import React, { useState, useEffect } from 'react';
import { Users, Play, ArrowLeft, Loader2, Music, UserCheck, UserPlus, UserMinus, Check } from 'lucide-react';
import TrackList from './TrackList';

export default function ArtistsView({
  onSelectTrack,
  currentTrack,
  isPlaying,
  userProfile,
  onLogin,
  likedSongIds,
  onToggleLike,
}) {
  const [artists, setArtists] = useState([]);
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [artistDetail, setArtistDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (!userProfile?.isLoggedIn) {
      setLoading(false);
      return;
    }

    async function loadArtists() {
      setLoading(true);
      try {
        const data = await window.api.yt.getSubscribedArtists();
        setArtists(data?.artists || []);
      } catch (err) {
        console.error('Failed to load subscribed artists:', err);
      } finally {
        setLoading(false);
      }
    }

    loadArtists();
  }, [userProfile?.isLoggedIn]);

  const handleOpenArtist = async (artist) => {
    setSelectedArtist(artist);
    if (!artist.id) return;

    setLoadingDetail(true);
    try {
      const data = await window.api.yt.getArtist(artist.id);
      setArtistDetail(data);
    } catch (err) {
      console.error('Failed to fetch artist details:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const isSubscribed = (artistId) => {
    return artists.some((a) => a.id === artistId);
  };

  const handleToggleSubscribe = async (artist) => {
    const channelId = artist.id;
    if (!channelId || subscribing) return;

    const currentlySubbed = isSubscribed(channelId);
    setSubscribing(true);

    try {
      if (currentlySubbed) {
        await window.api.yt.unsubscribeArtist(channelId);
        setArtists((prev) => prev.filter((a) => a.id !== channelId));
      } else {
        await window.api.yt.subscribeArtist(channelId);
        setArtists((prev) => [
          ...prev,
          {
            id: channelId,
            name: artist.name,
            subscribers: artist.subscribers || 'Subscribed',
            thumbnail: artist.thumbnail || artistDetail?.header?.thumbnail,
          },
        ]);
      }
    } catch (e) {
      console.error('Failed to toggle subscribe:', e);
    } finally {
      setSubscribing(false);
    }
  };

  if (!userProfile?.isLoggedIn) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-center max-w-md mx-auto gap-4">
        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
          <Users className="w-8 h-8 text-[#fa2d48]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Subscribed Artists</h2>
          <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
            Connect your Google account to access your subscribed artists and explore their top songs and discography directly in iTune.
          </p>
        </div>
        <button
          onClick={onLogin}
          className="mt-2 px-6 py-2.5 rounded-xl font-semibold text-xs bg-white text-neutral-950 hover:bg-neutral-100 transition-all shadow-md active:scale-95 flex items-center gap-2"
        >
          <UserCheck className="w-4 h-4 text-[#fa2d48]" />
          Sign In with Google
        </button>
      </div>
    );
  }

  // Artist Detail Page
  if (selectedArtist) {
    const subbed = isSubscribed(selectedArtist.id);

    return (
      <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
        <button
          onClick={() => {
            setSelectedArtist(null);
            setArtistDetail(null);
          }}
          className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Subscribed Artists
        </button>

        {loadingDetail ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-neutral-400">
            <Loader2 className="w-7 h-7 animate-spin text-[#fa2d48]" />
            <span className="text-xs">Loading artist discography...</span>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {/* Artist Header */}
            <div className="flex flex-col md:flex-row items-start md:items-end gap-6 pt-2">
              <div className="w-40 h-40 rounded-full overflow-hidden bg-neutral-800 shadow-2xl flex-shrink-0 ring-4 ring-[#fa2d48]/20">
                {selectedArtist.thumbnail || artistDetail?.header?.thumbnail ? (
                  <img
                    src={artistDetail?.header?.thumbnail || selectedArtist.thumbnail}
                    alt={selectedArtist.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-neutral-800">
                    <Music className="w-16 h-16 text-neutral-600" />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 flex-1 min-w-0">
                <span className="text-xs uppercase font-bold tracking-wider text-[#fa2d48]">
                  Artist
                </span>
                <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight truncate">
                  {artistDetail?.header?.name || selectedArtist.name}
                </h1>
                <p className="text-xs text-neutral-400">
                  {selectedArtist.subscribers || artistDetail?.header?.subscribers || 'Followed Artist'}
                </p>

                <div className="flex items-center gap-3 pt-2">
                  {artistDetail?.sections?.[0]?.tracks?.length > 0 && (
                    <button
                      onClick={() =>
                        onSelectTrack(
                          artistDetail.sections[0].tracks[0],
                          artistDetail.sections[0].tracks
                        )
                      }
                      className="px-6 py-2.5 rounded-xl bg-[#fa2d48] hover:bg-[#fa586a] text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-[#fa2d48]/30 transition-all active:scale-95 w-fit"
                    >
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                      Play Top Songs
                    </button>
                  )}

                  {/* Real-Time Subscribe Button synced to YouTube */}
                  {selectedArtist.id && (
                    <button
                      onClick={() => handleToggleSubscribe(selectedArtist)}
                      disabled={subscribing}
                      className={`px-5 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all active:scale-95 ${
                        subbed
                          ? 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
                          : 'bg-white text-neutral-950 hover:bg-neutral-100 shadow-md'
                      }`}
                    >
                      {subscribing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : subbed ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Subscribed</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5 text-[#fa2d48]" />
                          <span>Subscribe on YouTube</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Sections (Top Songs, Albums, etc.) */}
            {artistDetail?.sections && artistDetail.sections.length > 0 ? (
              artistDetail.sections.map((section, idx) => (
                <div key={idx} className="flex flex-col gap-3">
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    {section.title}
                  </h3>
                  <TrackList
                    tracks={section.tracks}
                    currentTrack={currentTrack}
                    isPlaying={isPlaying}
                    onSelectTrack={onSelectTrack}
                    likedSongIds={likedSongIds}
                    onToggleLike={onToggleLike}
                  />
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-neutral-500 text-sm">
                No songs available for this artist right now.
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Artists Grid View
  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Subscribed Artists</h2>
        <p className="text-xs text-neutral-400 mt-0.5">Artists you follow on your YouTube Music account</p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-neutral-400">
          <Loader2 className="w-7 h-7 animate-spin text-[#fa2d48]" />
          <span className="text-xs">Fetching your subscribed artists from YouTube Music...</span>
        </div>
      ) : artists.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {artists.map((artist, idx) => (
            <div
              key={artist.id || idx}
              onClick={() => handleOpenArtist(artist)}
              className="glass-card group p-4 flex flex-col items-center text-center gap-3 cursor-pointer relative"
            >
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-neutral-800 relative shadow-md ring-2 ring-white/10 group-hover:ring-[#fa2d48] transition-all duration-300">
                {artist.thumbnail ? (
                  <img
                    src={artist.thumbnail}
                    alt={artist.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                    <Music className="w-10 h-10 text-neutral-600" />
                  </div>
                )}
                <button className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-[#fa2d48] text-white flex items-center justify-center shadow-lg shadow-[#fa2d48]/40 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 duration-200">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </button>
              </div>

              <div className="flex flex-col items-center w-full min-w-0">
                <span className="text-sm font-semibold text-white truncate w-full group-hover:text-[#fa2d48] transition-colors">
                  {artist.name}
                </span>
                <span className="text-xs text-neutral-400 truncate mt-0.5">
                  {artist.subscribers || 'Artist'}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-20 text-center text-neutral-500 text-sm">
          No subscribed artists found in your YouTube Music library. Try subscribing to artists on YouTube Music!
        </div>
      )}
    </div>
  );
}
