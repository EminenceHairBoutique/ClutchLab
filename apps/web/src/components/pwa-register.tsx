"use client";

import { useEffect } from "react";

/** Registers the offline/push service worker (no-op where unsupported). */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.warn("service worker registration failed", error);
    });
  }, []);
  return null;
}
