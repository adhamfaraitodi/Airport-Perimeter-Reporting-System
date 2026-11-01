"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "perimeter-theme";

let cachedTheme: Theme | null = null;
const listeners = new Set<() => void>();

function readClientTheme(): Theme {
  if (cachedTheme) return cachedTheme;
  if (typeof window === "undefined") return "light";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") {
      cachedTheme = saved;
      return saved;
    }
  } catch {
    /* Optional browser storage. */
  }
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
  cachedTheme = prefersDark;
  return prefersDark;
}

function getServerSnapshot(): Theme {
  return "light";
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window === "undefined") {
    return () => listeners.delete(listener);
  }

  function handleStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY) {
      const next = event.newValue === "dark" ? "dark" : "light";
      cachedTheme = next;
      listeners.forEach((fn) => fn());
    }
  }

  window.addEventListener("storage", handleStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function updateTheme(next: Theme) {
  cachedTheme = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* Theme remains usable without persistence. */
    }
    document.documentElement.setAttribute("data-theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }
  listeners.forEach((fn) => fn());
}

/** Persistent light/dark theme shared across login, reporter, technician, and operator pages. */
export function useTheme() {
  const theme = useSyncExternalStore(
    subscribe,
    readClientTheme,
    getServerSnapshot
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    updateTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    const current = readClientTheme();
    updateTheme(current === "dark" ? "light" : "dark");
  }, []);

  return {
    theme,
    dark: theme === "dark",
    setTheme,
    toggleTheme,
  };
}
