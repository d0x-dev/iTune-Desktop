import React from "react";
import AndroidIcon from "./AndroidIcon";

export default function FavoriteIcon({ filled = false, size = 18, className = "" }) {
  return (
    <AndroidIcon
      name={filled ? "ic_star_filled" : "ic_star_outline"}
      size={size}
      className={className}
    />
  );
}
