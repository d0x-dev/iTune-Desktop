import React, { useState } from "react";
import { Music2 } from "lucide-react";
import { artworkCandidates } from "../../shared/artwork.mjs";

export default function Artwork({
  src,
  title = "",
  className = "",
  eager = false,
  children,
}) {
  const [attempt, setAttempt] = useState({ source: null, index: 0 });
  const candidates = artworkCandidates(src);
  const index = attempt.source === src ? attempt.index : 0;
  const currentSource = candidates[index];
  const nextCandidate = () => setAttempt({ source: src, index: index + 1 });
  return (
    <div className={`artwork ${className}`}>
      {currentSource ? (
        <img
          key={currentSource}
          src={currentSource}
          alt={title}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={nextCandidate}
          onLoad={(event) => {
            if (
              currentSource.includes("/maxresdefault.") &&
              event.currentTarget.naturalWidth <= 120
            )
              nextCandidate();
          }}
        />
      ) : (
        <div className="artwork-placeholder">
          <Music2 aria-hidden="true" />
        </div>
      )}
      {children}
    </div>
  );
}
