"use client";

import { Moon, Sun } from "lucide-react";
import type { SessionUser } from "../_lib/client-api";

export interface AppHeaderProps {
  user: SessionUser;
  dark: boolean;
  onToggleTheme: () => void;
  /** Optional role caption shown next to the avatar on wide screens. */
  roleLabel?: string;
  /** Max width of the inner container, e.g. "max-w-5xl". */
  containerClassName?: string;
}

function initialsOf(user: SessionUser) {
  const displayName = user.name?.trim() || user.email || "Pengguna";
  return user.name?.trim()
    ? user.name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => Array.from(word)[0])
        .join("")
        .toUpperCase()
    : Array.from(displayName).slice(0, 2).join("").toUpperCase();
}

export function AppHeader({
  user,
  dark,
  onToggleTheme,
  roleLabel,
  containerClassName = "max-w-5xl",
}: AppHeaderProps) {
  const displayName = user.name?.trim() || user.email || "Pengguna";

  return (
    <header className="bg-[var(--rd-panel)]">
      <div
        className={`mx-auto flex h-[86px] items-center justify-between gap-3 px-[18px] sm:px-8 ${containerClassName}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <img
            src={dark ? "/injourney-logo-white.webp" : "/injourney-logo.webp"}
            alt="InJourney Airports"
            className="h-auto w-[68px] shrink-0 sm:w-24"
          />
          <span className="max-w-[155px] text-[11px] leading-tight sm:max-w-56 sm:text-sm">
            Airport Perimeter
            <br />
            Reporting System
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggleTheme}
            className="grid size-11 min-h-11 place-items-center rounded-full bg-transparent p-0 text-[var(--rd-text)] transition-colors hover:bg-[var(--rd-active)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--rd-link)]"
            aria-label={dark ? "Aktifkan light mode" : "Aktifkan dark mode"}
          >
            {dark ? (
              <Sun size={27} strokeWidth={1.7} />
            ) : (
              <Moon size={29} strokeWidth={1.7} />
            )}
          </button>
          <span
            className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--rd-surface)] text-xs"
            title={displayName}
            aria-label={displayName}
          >
            {initialsOf(user)}
          </span>
          {roleLabel && (
            <span className="hidden leading-tight min-[1100px]:block">
              <strong className="block text-xs">{displayName}</strong>
              <span className="mt-1 block text-[11px] text-[var(--rd-muted)]">
                {roleLabel}
              </span>
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
