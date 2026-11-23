import React, { useRef } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import Artwork from "./Artwork";
import { getArtistName } from "../utils/format";
import AndroidIcon from "./AndroidIcon";
import ExplicitTitle from "./ExplicitTitle";

export default function MediaShelf({
  title,
  items = [],
  onSelect,
  editorial = false,
  layout,
  strapline,
  currentTrack,
  isPlaying,
  heroStyle = "apple",
  onContextMenu,
}) {
  const shelf = useRef(null);
  const shelfLayout =
    layout ||
    (items.every((item) => item.type === "artist") ? "artists" : "cards");
  return (
    <section
      className={`media-section ${editorial ? `editorial-section hero-${heroStyle}` : ""}`}
    >
      <div className="section-heading">
        <div>
          {strapline && <p className="shelf-strapline">{strapline}</p>}
          <h2>{title}</h2>
        </div>
        <div className="shelf-controls">
          <button
            className="icon-button"
            aria-label={`Scroll ${title} left`}
            onClick={() =>
              shelf.current?.scrollBy({
                left: -shelf.current.clientWidth,
                behavior: "smooth",
              })
            }
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="icon-button"
            aria-label={`Scroll ${title} right`}
            onClick={() =>
              shelf.current?.scrollBy({
                left: shelf.current.clientWidth,
                behavior: "smooth",
              })
            }
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div
        className={`media-shelf no-scrollbar ${shelfLayout}-shelf`}
        ref={shelf}
      >
        {items.map((item, index) =>
          shelfLayout === "songs" && !editorial ? (
            <button
              key={`${item.id}-${index}`}
              className={`shelf-song ${currentTrack?.id === item.id ? "current" : ""}`}
              onClick={() => onSelect(item, items)}
              onContextMenu={(event) => onContextMenu?.(event, item, items)}
            >
              <div className="shelf-song-art">
                <Artwork src={item.thumbnail} title="" />
                {currentTrack?.id === item.id && isPlaying && (
                  <span className="equalizer">
                    <i />
                    <i />
                    <i />
                  </span>
                )}
              </div>
              <span className="shelf-song-text">
                <strong><ExplicitTitle item={item} /></strong>
                <small>{getArtistName(item)}</small>
              </span>
              <AndroidIcon name="play" size={14} className="song-hover-play" />
            </button>
          ) : editorial ? (
            <button
              className={`media-card hero-media-card hero-${heroStyle}-card`}
              key={`${item.id}-${index}`}
              onClick={() => onSelect(item, items)}
              onContextMenu={(event) => onContextMenu?.(event, item, items)}
            >
              {heroStyle === "landscape" && (
                <div className="editorial-caption">
                  <span>{heroCategory(item)}</span>
                  <h3><ExplicitTitle item={item} /></h3>
                  <p>{getArtistName(item)}</p>
                </div>
              )}
              {heroStyle === "apple" && (
                <div className="hero-external-tag">{heroCategory(item)}</div>
              )}
              <div className="media-cover hero-cover">
                <Artwork src={item.thumbnail} title={item.title} eager />
                {heroStyle !== "landscape" && (
                  <div
                    className={`hero-brand ${heroStyle === "portrait" ? "align-right" : ""}`}
                  >
                    <AndroidIcon name="ic_itune_waves" size={16} />
                    <span>iTune</span>
                  </div>
                )}
                {heroStyle === "apple" && (
                  <h3 className="hero-overlay-title"><ExplicitTitle item={item} /></h3>
                )}
                <div className="hero-detail-glass">
                  {heroStyle === "portrait" && (
                    <>
                      <span>{heroCategory(item)}</span>
                      <h3><ExplicitTitle item={item} /></h3>
                    </>
                  )}
                  <p>{item.subtitle || getArtistName(item)}</p>
                </div>
                <span className="cover-play">
                  <Play size={19} fill="currentColor" />
                </span>
              </div>
            </button>
          ) : (
            <button
              className={`media-card ${item.type === "artist" ? "artist-media-card" : ""}`}
              key={`${item.id}-${index}`}
              onClick={() => onSelect(item, items)}
              onContextMenu={(event) => onContextMenu?.(event, item, items)}
            >
              <div className="media-cover">
                <Artwork
                  src={item.thumbnail}
                  title={item.title}
                  eager={false}
                />
                <span className="cover-play">
                  <Play size={19} fill="currentColor" />
                </span>
              </div>
              <div className="media-caption">
                <h3><ExplicitTitle item={item} /></h3>
                <p>{getArtistName(item)}</p>
              </div>
            </button>
          ),
        )}
      </div>
    </section>
  );
}

function heroCategory(item) {
  if (item.type === "album") return "Featured Album";
  if (item.type === "playlist") return "Made for You";
  return "Top Pick";
}
