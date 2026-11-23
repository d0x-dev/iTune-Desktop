import React, { useEffect, useRef } from "react";
import { RefreshCw, Loader2, Radio } from "lucide-react";
import { useHomeFeed } from "../utils/homeFeed";
import MediaShelf from "./MediaShelf";
import { usePreferences } from "../utils/preferences";

export default function DiscoveryView({
  kind = "home",
  onSelectTrack,
  userProfile,
  currentTrack,
  isPlaying,
  onStartRadio,
  onBackdropChange,
  onContextMenu,
}) {
  const { preferences } = usePreferences();
  const feed = useHomeFeed(kind, userProfile);
  const sentinel = useRef(null);
  useEffect(() => {
    if (!feed.continuation || feed.error || feed.loadingMore || !sentinel.current)
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) feed.loadMore();
      },
      { rootMargin: "600px" },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [feed.continuation, feed.error, feed.loadingMore, feed.loadMore]);
  const title = kind === "new" ? "New" : kind === "radio" ? "Radio" : "Home";
  const allItems = feed.sections.flatMap((section) => section.contents);
  const featured = allItems
    .filter((item) => ["album", "playlist"].includes(item.type))
    .filter(
      (item, index, items) =>
        items.findIndex((other) => other.id === item.id) === index,
    )
    .slice(0, 6);
  const radioSections = feed.sections.filter((section) =>
    /radio|mix|station/i.test(section.title),
  );
  const sections = kind === "radio" ? radioSections : feed.sections;
  useEffect(() => {
    const artwork =
      featured[0]?.thumbnail ||
      sections.find((section) => section.contents?.[0]?.thumbnail)
        ?.contents?.[0]?.thumbnail ||
      null;
    onBackdropChange?.(artwork);
  }, [featured[0]?.thumbnail, sections, onBackdropChange]);
  return (
    <div className={`page home-page ${kind}-page`}>
      <header className="page-heading">
        <h1>{title}</h1>
        <button
          className="icon-button"
          aria-label={`Refresh ${title}`}
          onClick={feed.refresh}
        >
          <RefreshCw size={17} />
        </button>
      </header>
      {feed.loading && !feed.sections.length ? (
        <div
          className="home-skeleton"
          aria-label="Loading recommendations"
          aria-busy="true"
        >
          <div className="skeleton-title" />
          <div className="skeleton-row">
            {[0, 1, 2].map((index) => (
              <div key={index} className="skeleton-card" />
            ))}
          </div>
          <div className="skeleton-row small">
            {[0, 1, 2, 3, 4].map((index) => (
              <div key={index} className="skeleton-card" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {featured.length > 0 && (
            <MediaShelf
              title={
                kind === "new"
                  ? "Featured Releases"
                  : kind === "radio"
                    ? "Stations for You"
                    : "Top Picks for You"
              }
              items={featured}
              onSelect={onSelectTrack}
              editorial
              heroStyle={preferences.homeHeroStyle}
              onContextMenu={onContextMenu}
            />
          )}
          {sections.map((section) => (
            <MediaShelf
              key={`${section.title}-${section.strapline || ""}`}
              title={section.title}
              strapline={section.strapline}
              layout={section.layout}
              items={section.contents}
              onSelect={
                kind === "radio" && section.layout === "songs"
                  ? onStartRadio
                  : onSelectTrack
              }
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onContextMenu={onContextMenu}
            />
          ))}
          {kind === "radio" &&
            !radioSections.length &&
            allItems.filter((item) => ["song", "video"].includes(item.type))
              .length > 0 && (
              <MediaShelf
                title="Start a Station"
                layout="songs"
                items={allItems.filter((item) =>
                  ["song", "video"].includes(item.type),
                )}
                onSelect={onStartRadio}
                onContextMenu={onContextMenu}
              />
            )}
          {!feed.sections.length && (
            <div className="empty-state">
              <Radio />
              <h2>
                {feed.error ? "Music couldn’t load" : "Find your next favorite"}
              </h2>
              <p>{feed.error || "Search for the music you love."}</p>
              <button className="primary-button" onClick={feed.refresh}>
                Try again
              </button>
            </div>
          )}
          <div ref={sentinel} className="feed-pagination">
            {feed.loadingMore ? (
              <>
                <Loader2 size={19} className="animate-spin" />
                <span>Loading more music…</span>
              </>
            ) : feed.continuation && !feed.error ? (
              <button className="text-button" onClick={feed.loadMore}>
                Load More
              </button>
            ) : null}
            {feed.error && !feed.loadingMore && feed.sections.length > 0 && (
              <button
                className="text-button"
                onClick={feed.continuation ? feed.loadMore : feed.refresh}
              >
                Try loading more music again
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
