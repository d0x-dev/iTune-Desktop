import React from "react";

export default function AndroidIcon({ name, size = 20, className = "" }) {
  return (
    <span
      aria-hidden="true"
      className={`android-icon ${className}`}
      style={{
        width: size,
        height: size,
        maskImage: `url(${import.meta.env.BASE_URL}android-icons/${name}.svg)`,
        WebkitMaskImage: `url(${import.meta.env.BASE_URL}android-icons/${name}.svg)`,
      }}
    />
  );
}
