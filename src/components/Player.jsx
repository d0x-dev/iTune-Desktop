import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Shuffle,
  Repeat,
  Repeat1,
  MessageSquareText,
  Loader2,
  ListMusic,
  Music2,
  SlidersHorizontal,
} from "lucide-react";
import Artwork from "./Artwork";
import AndroidIcon from "./AndroidIcon";
import FavoriteIcon from "./FavoriteIcon";
import ExplicitTitle from "./ExplicitTitle";
import { getArtistName, formatTime } from "../utils/format";
import { usePreferences } from "../utils/preferences";
import AudioEffectsPanel from "./AudioEffectsPanel";
import AnimatedPresence from "./AnimatedPresence";
import { applyAudioEffects, resumeAudioEffects } from "../utils/audioEngine";

const Player = forwardRef(function Player(
  {
    currentTrack,
    isPlaying,
    setIsPlaying,
