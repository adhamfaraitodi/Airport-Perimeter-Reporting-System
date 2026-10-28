"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  Database,
  Fence,
  LogOut,
  MoonStar,
  SquareChartGantt,
  Sun,
  User,
  Users,
} from "lucide-react";
import type { SessionUser } from "../_lib/client-api";

export interface AppHeaderProps {
  user: SessionUser;
  dark: boolean;
  onToggleTheme: () => void;
  /** Optional role caption shown next to the avatar on wide screens. */
  roleLabel?: string;
  /** Max width of the inner container, e.g. "max-w-5xl". */
  containerClassName?: string;
  /** Optional unread notification indicator. */
  hasNotification?: boolean;
  onNotificationClick?: () => void;
  /** Optional callback or navigation for logout. */
  onLogout?: () => void;
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
  hasNotification = false,
  onNotificationClick,
  onLogout,
}: AppHeaderProps) {
  const params = useParams<{ locale?: string }>();
  const router = useRouter();
  const locale = params?.locale || "id";

  const [dataMasterOpen, setDataMasterOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const dataMasterRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);

  const isOperator =
    user.role === "OPERATOR" ||
    roleLabel?.toLowerCase().includes("operator");

  const displayName = user.name?.trim() || user.email || "Pengguna";

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        dataMasterRef.current &&
        !dataMasterRef.current.contains(target)
      ) {
        setDataMasterOpen(false);
      }
      if (
        profileRef.current &&
        !profileRef.current.contains(target)
      ) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleLogout() {
    setProfileOpen(false);
    if (onLogout) {
      onLogout();
    } else {
      router.push(`/${locale}/login`);
    }
  }

  return (
    <header className="border-b border-[var(--rd-border)] bg-[var(--rd-panel)]">
      <div
        className={`mx-auto flex h-[86px] items-center justify-between gap-3 px-[18px] sm:px-8 ${containerClassName}`}
      >
        {/* Left: Branding & Operator Navigation */}
        <div className="flex min-w-0 items-center gap-6">
          <div className="flex shrink-0 items-center gap-3">
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

          {/* Navigation for Operator Dashboard */}
          {isOperator && (
            <nav className="hidden items-center gap-1.5 md:flex">
              <Link
                href={`/${locale}/dashboard`}
                className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-[var(--rd-text)] transition-colors hover:bg-[var(--rd-active)] hover:text-[var(--rd-link)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)]"
              >
                <SquareChartGantt size={22} strokeWidth={1.8} aria-hidden="true" />
                <span className="block text-[13px] font-medium text-[var(--rd-text)]">Dashboard</span>
              </Link>

              {/* Data Master Dropdown */}
              <div className="relative" ref={dataMasterRef}>
                <button
                  type="button"
                  onClick={() => setDataMasterOpen((prev) => !prev)}
                  aria-expanded={dataMasterOpen}
                  aria-haspopup="menu"
                  className={`inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)] ${
                    dataMasterOpen
                      ? "bg-[var(--rd-active)] text-[var(--rd-link)]"
                      : "text-[var(--rd-text)] hover:bg-[var(--rd-active)] hover:text-[var(--rd-link)]"
                  }`}
                >
                  <Database size={22} strokeWidth={1.8} aria-hidden="true" />
                  <span className="block text-[13px] font-medium text-[var(--rd-text)]">Data Master</span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${
                      dataMasterOpen ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {dataMasterOpen && (
                  <div
                    role="menu"
                    className="absolute left-0 top-full z-[100] mt-1.5 w-52 rounded-2xl border border-[var(--rd-border)] bg-[var(--rd-surface)] p-1.5 text-[var(--rd-text)] shadow-xl animate-in fade-in zoom-in-95 duration-100"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => setDataMasterOpen(false)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-[var(--rd-hover)] hover:text-[var(--rd-link)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)]"
                    >
                      <Fence size={18} strokeWidth={1.8} className="shrink-0 text-[var(--rd-muted)]" aria-hidden="true" />
                      <span className="block text-[13px] font-medium text-[var(--rd-text)]">Kerusakan perimeter</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => setDataMasterOpen(false)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-[var(--rd-hover)] hover:text-[var(--rd-link)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)]"
                    >
                      <Users size={18} strokeWidth={1.8} className="shrink-0 text-[var(--rd-muted)]" aria-hidden="true" />
                      <span className="block text-[13px] font-medium text-[var(--rd-text)]">Kelola akun</span>
                    </button>
                  </div>
                )}
              </div>
            </nav>
          )}
        </div>

        {/* Right: Theme, Notification & User Account Menu */}
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={onToggleTheme}
            className="grid size-10 place-items-center rounded-xl bg-transparent p-0 text-[var(--rd-text)] transition-colors hover:bg-[var(--rd-active)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)]"
            aria-label={dark ? "Aktifkan light mode" : "Aktifkan dark mode"}
          >
            {dark ? (
              <Sun size={22} strokeWidth={1.8} />
            ) : (
              <MoonStar size={22} strokeWidth={1.8} />
            )}
          </button>

          <button
            type="button"
            onClick={onNotificationClick}
            aria-label="Notifikasi"
            className="relative grid size-10 place-items-center rounded-xl bg-transparent p-0 text-[var(--rd-text)] transition-colors hover:bg-[var(--rd-active)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)]"
          >
            <Bell size={21} strokeWidth={1.9} />
            {hasNotification && (
              <span
                className="absolute top-2 right-2 size-2.5 rounded-full bg-[var(--rd-coral)] ring-2 ring-[var(--rd-panel)]"
                aria-hidden="true"
              />
            )}
          </button>

          {/* Account Profile Trigger & Dropdown */}
          <div className="relative pl-1" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((prev) => !prev)}
              aria-expanded={profileOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2.5 rounded-2xl p-1 text-left transition-colors hover:bg-[var(--rd-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)]"
            >
              <span
                className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--rd-surface)] text-sm font-semibold tracking-wide text-[var(--rd-text)] shadow-xs"
                title={displayName}
                aria-label={displayName}
              >
                {initialsOf(user)}
              </span>
              <div className="hidden leading-tight sm:block">
                <strong className="block text-[13px] font-semibold text-[var(--rd-text)]">
                  {displayName}
                </strong>
                <span className="block text-[11px] text-[var(--rd-muted)]">
                  {roleLabel || "Pelapor"}
                </span>
              </div>
            </button>

            {/* Profile Dropdown Menu */}
            {profileOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-[100] mt-2 w-56 rounded-2xl border border-[var(--rd-border)] bg-[var(--rd-surface)] p-2 text-[var(--rd-text)] shadow-xl animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="border-b border-[var(--rd-border)] px-3 py-2 sm:hidden">
                  <p className="text-xs font-semibold text-[var(--rd-text)]">{displayName}</p>
                  <p className="text-[10px] text-[var(--rd-muted)]">{roleLabel || "Pelapor"}</p>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setProfileOpen(false)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition-colors hover:bg-[var(--rd-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)]"
                >
                  <User size={18} strokeWidth={1.8} className="shrink-0 text-[var(--rd-muted)]" aria-hidden="true" />
                  <span className="block text-[13px] font-medium text-[var(--rd-text)]">Profil saya</span>
                </button>
                <div className="my-1 border-t border-[var(--rd-border)]" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-[var(--rd-coral)] transition-colors hover:bg-[var(--rd-coral)]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)]"
                >
                  <LogOut size={18} strokeWidth={1.8} className="shrink-0" aria-hidden="true" />
                  <span className="block text-[13px] font-medium">Keluar</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
