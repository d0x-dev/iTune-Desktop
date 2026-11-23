import React from "react";
import Artwork from "./Artwork";
import Canvas from "./Canvas";

export default function ArtworkBackdrop({ src, canvas, className = "" }) {
  if (!src) return null;
  return (
    <div className={`artwork-backdrop ${className}`} aria-hidden="true">
      <Artwork src={src} eager />
      <Canvas src={canvas} />
      <div className="artwork-backdrop-shade" />
    </div>
  );
}
