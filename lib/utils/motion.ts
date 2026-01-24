"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";

export const useReducedMotionSafe = () => {
  const prefersReducedMotion = useReducedMotion();
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return prefersReducedMotion ?? reduced;
};

export const motionDuration = (reducedMotion: boolean, duration: number) => (reducedMotion ? 0 : duration);
