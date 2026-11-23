import { useEffect, useState } from "react";
import ITuneWaveIcon from "./ITuneWaveIcon";
import { useFestival } from "../utils/festival";

export default function FestivalBrand() {
  const festival = useFestival();
  const [text, setText] = useState("iTune");

  useEffect(() => {
    setText("iTune");
    if (!festival.enabled || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let timer;
    const wait = (milliseconds) => new Promise((resolve) => {
      timer = setTimeout(resolve, milliseconds);
    });
    const spell = async (value, delay, deleting = false) => {
      const lengths = deleting
        ? Array.from({ length: value.length }, (_, index) => value.length - index - 1)
        : Array.from({ length: value.length }, (_, index) => index + 1);
      for (const length of lengths) {
        if (cancelled) return;
        setText(value.slice(0, length));
        await wait(delay);
      }
    };
    const animate = async () => {
