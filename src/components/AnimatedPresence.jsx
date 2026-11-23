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

    setState("closing");
    const timeout = setTimeout(() => {
      setMounted(false);
      setState("closed");
    }, duration);
    return () => clearTimeout(timeout);
  }, [duration, mounted, show]);

  if (!mounted) return null;

  return (
    <div
      className={`animated-presence ${className}`.trim()}
      data-state={state}
      aria-hidden={state === "closing" ? "true" : undefined}
      inert={state === "closing"}
    >
      {show ? children : lastChildren.current}
    </div>
  );
}
