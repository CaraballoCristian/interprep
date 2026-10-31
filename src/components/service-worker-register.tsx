"use client";

import { useEffect } from "react";

/**
 * Registers the app-shell service worker. It is skipped in development so a
 * stale cache never interferes with hot reloading.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    function register() {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // Installation is optional; the app still works without it.
      });
    }

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
