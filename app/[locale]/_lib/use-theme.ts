"use client";

import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "perimeter-theme";

function initialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* Optional browser storage. */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Light/dark theme shared by login, reporter and operator pages. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(initialTheme());
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* Theme remains usable without persistence. */
    }
  }, [theme]);

  return {
    theme,
    dark: theme === "dark",
    toggleTheme: () => setTheme((value) => (value === "dark" ? "light" : "dark")),
  };
}
