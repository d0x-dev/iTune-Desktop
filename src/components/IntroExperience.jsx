import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import ITuneWaveIcon from "./ITuneWaveIcon";

// Desktop port of Android iTune WelcomeScreen.kt and SplashScreen.kt.
// Originally created by DxV Studio ~~ Dark. Credits: DxV Studio, AirBeats, Dark. GPL-3.0.
const AMBIENT_FRAMES = [
  ["#0A031D", "#280659", "#FF0080", "#FF8800", "#130533"],
  ["#030304", "#140204", "#DF0024", "#CE001E", "#040406"],
  ["#020309", "#040B22", "#0047FF", "#0043FF", "#02050E"],
  ["#63264D", "#532149", "#FF629C", "#FFB26B", "#663D7F"],
  ["#FFFDFD", "#FFF6F9", "#FF9BBE", "#FFDF9B", "#FFF2F7"],
  ["#FFFFFF", "#FDFBFF", "#FF96BE", "#FFE3A2", "#D6C3FF"],
  ["#281040", "#331350", "#FF3A88", "#FF9A38", "#231144"],
];

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const GOOGLE_LOGO = `${import.meta.env.BASE_URL}android-icons/ic_google_logo.svg`;

function AmbientMesh() {
  return (
    <div className="welcome-mesh" aria-hidden="true">
      {AMBIENT_FRAMES.map(([base, center, topRight, bottomLeft, bottomRight], index) => (
        <span
          className="welcome-mesh-frame"
          key={base}
          style={{
            "--ambient-delay": `${-35 + index * 5}s`,
            backgroundColor: base,
            backgroundImage: `radial-gradient(circle at 50% 48%, ${center} 0%, transparent 58%), radial-gradient(circle at 94% 4%, ${topRight} 0%, transparent 54%), radial-gradient(circle at 4% 96%, ${bottomLeft} 0%, transparent 52%), radial-gradient(circle at 96% 96%, ${bottomRight} 0%, transparent 48%)`,
          }}
        />
      ))}
      <span className="welcome-mesh-sheen" />
    </div>
  );
}
