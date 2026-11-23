import React, { useEffect, useRef, useState } from "react";

export default function AnimatedPresence({
  show,
  duration = 260,
  className = "",
  children,
}) {
  const [mounted, setMounted] = useState(show);
  const [state, setState] = useState(show ? "open" : "closed");
  const lastChildren = useRef(children);

  if (show) lastChildren.current = children;

  useEffect(() => {
    if (show) {
      setMounted(true);
      setState("open");
      return undefined;
    }
    if (!mounted) return undefined;
