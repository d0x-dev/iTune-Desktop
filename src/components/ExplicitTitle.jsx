import React from "react";

export default function ExplicitTitle({ item, title, className = "" }) {
  return (
    <span className={`explicit-title ${className}`}>
      {item?.isExplicit && <span className="explicit-mark" aria-label="Explicit">E</span>}
      <span>{title ?? item?.title}</span>
    </span>
  );
}
