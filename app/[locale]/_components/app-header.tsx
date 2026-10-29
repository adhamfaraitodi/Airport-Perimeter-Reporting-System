"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  ChevronDown,
  ClipboardCheck,
  ClipboardClock,
  ClipboardPen,
  Database,
  Fence,
  LogOut,
  MoonStar,
  SquareChartGantt,
  Sun,
  User,
  Users,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import type { SessionUser } from "../_lib/client-api";

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  read: boolean;
}

const initialOperatorNotifications: NotificationItem[] = [
  {
    id: "notif-1",
    title: "Laporan Baru · Pagar Harmonika / BRC",
    description: "Berlubang & klem terlepas di Sisi Selatan (Grid M14).",
    time: "5 menit lalu",
    status: "OPEN",
    read: false,
  },
  {
    id: "notif-2",
    title: "Laporan Baru · Kawat Duri / Razor",
    description: "Kawat duri terlepas di Sisi Barat (Grid K3).",
    time: "28 menit lalu",
    status: "OPEN",
    read: false,
  },
  {
    id: "notif-3",
    title: "Status Diperbarui · Ditangani",
    description: "Perbaikan tiang pagar miring di Sisi Timur (Grid L25) sedang berlangsung.",
    time: "1 jam lalu",
    status: "IN_PROGRESS",
    read: true,
  },
  {
    id: "notif-4",
    title: "Perbaikan Selesai · Pondasi",
    description: "Celah pondasi Sisi Utara (Grid I12) telah ditutup dan diverifikasi.",
    time: "Kemarin, 16:40 WIB",
    status: "RESOLVED",
    read: true,
  },
];

const initialReporterNotifications: NotificationItem[] = [
  {
    id: "notif-r1",
    title: "Laporan Anda Sedang Ditangani",
    description: "Operator menindaklanjuti laporan Pagar Harmonika di Sisi Selatan (Grid M14).",
    time: "12 menit lalu",
    status: "IN_PROGRESS",
    read: false,
  },
  {
    id: "notif-r2",
    title: "Laporan Selesai Diverifikasi",
    description: "Perbaikan pondasi bercelah di Sisi Utara (Grid I12) telah dinyatakan selesai.",
    time: "Kemarin, 16:40 WIB",
    status: "RESOLVED",
    read: true,
  },
];

export interface AppHeaderProps {
  user?: SessionUser | null;
  dark: boolean;
  onToggleTheme: () => void;
  /** Optional role caption shown next to the avatar on wide screens. */
  roleLabel?: string;
  /** Max width of the inner container, e.g. "max-w-5xl". */
  containerClassName?: string;
  /** Optional unread notification indicator override. */
  hasNotification?: boolean;
  onNotificationClick?: () => void;
  /** Optional callback or navigation for logout. */
  onLogout?: () => void;
}

function initialsOf(user?: SessionUser | null) {
  if (!user) return "PG";
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
  hasNotification,
  onNotificationClick,
  onLogout,
}: AppHeaderProps) {
  const params = useParams<{ locale?: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const locale = params?.locale || "id";

  const isOperator =
    user?.role === "OPERATOR" ||
    Boolean(roleLabel?.toLowerCase().includes("operator"));

  const [dataMasterOpen, setDataMasterOpen] = useState(false);
  const [mobileDataMasterOpen, setMobileDataMasterOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifFilter, setNotifFilter] = useState<"ALL" | "UNREAD">("ALL");
  const [notifications, setNotifications] = useState<NotificationItem[]>(() =>
    isOperator ? initialOperatorNotifications : initialReporterNotifications
  );

  const dataMasterRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);

  const isPerimeterDamageActive = pathname?.includes(
    "/dashboard/perimeter-damage"
  );
  const isAccountsActive = pathname?.includes("/dashboard/accounts");
  const isDataMasterActive = isPerimeterDamageActive || isAccountsActive;
  const isDashboardHomeActive =
    pathname?.endsWith("/dashboard") && !isDataMasterActive;

  const displayName = user?.name?.trim() || user?.email || "Pengguna";

  const unreadCount = notifications.filter((n) => !n.read).length;
  const showUnreadDot =
    hasNotification !== undefined ? hasNotification : unreadCount > 0;

  const visibleNotifications =
    notifFilter === "UNREAD"
      ? notifications.filter((n) => !n.read)
      : notifications;

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
        setMobileDataMasterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function markAllAsRead() {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  }

  function handleSelectNotification(id: string) {
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read: true } : item))
    );
    setNotifOpen(false);
    const targetRoute = isOperator
      ? `/${locale}/dashboard`
      : `/${locale}/reports`;
    if (pathname !== targetRoute) {
      router.push(targetRoute);
    }
  }

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
        className={`mx-auto flex h-[72px] items-center justify-between gap-2 px-4 sm:h-[86px] sm:gap-3 sm:px-8 ${containerClassName}`}
      >
        {/* Left: Branding & Desktop Operator Navigation */}
        <div className="flex min-w-0 items-center gap-6">
          <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
            <img
              src={dark ? "/injourney-logo-white.webp" : "/injourney-logo.webp"}
              alt="InJourney Airports"
              className="h-auto w-[64px] shrink-0 sm:w-24"
            />
            <span className="max-w-[140px] text-[11px] leading-tight sm:max-w-56 sm:text-sm">
              Airport Perimeter
              <br />
              Reporting System
            </span>
          </div>

          {/* Desktop Navigation for Operator Dashboard */}
          {isOperator && (
            <nav className="hidden items-center gap-1.5 md:flex">
              <Link
                href={`/${locale}/dashboard`}
                className={`inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)] ${
                  isDashboardHomeActive
                    ? "bg-[var(--rd-active)] text-[var(--rd-link)]"
                    : "text-[var(--rd-text)] hover:bg-[var(--rd-active)] hover:text-[var(--rd-link)]"
                }`}
              >
                <SquareChartGantt size={20} strokeWidth={1.8} aria-hidden="true" />
                <span className="block text-[13px] font-medium">
                  Pantau Perimeter
                </span>
              </Link>

              {/* Desktop Data Master Dropdown */}
              <div className="relative" ref={dataMasterRef}>
                <button
                  type="button"
                  onClick={() => {
                    setDataMasterOpen((prev) => !prev);
                    setNotifOpen(false);
                    setProfileOpen(false);
                  }}
                  aria-expanded={dataMasterOpen}
                  aria-haspopup="menu"
                  className={`inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)] ${
                    dataMasterOpen || isDataMasterActive
                      ? "bg-[var(--rd-active)] text-[var(--rd-link)]"
                      : "text-[var(--rd-text)] hover:bg-[var(--rd-active)] hover:text-[var(--rd-link)]"
                  }`}
                >
                  <Database size={20} strokeWidth={1.8} aria-hidden="true" />
                  <span className="block text-[13px] font-medium">
                    Data Master
                  </span>
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
                    className="absolute left-0 top-full z-[600] mt-1.5 w-52 rounded-2xl border border-[var(--rd-border)] bg-[var(--rd-surface)] p-1.5 text-[var(--rd-text)] shadow-xl animate-in fade-in zoom-in-95 duration-100"
                  >
                    <Link
                      href={`/${locale}/dashboard/perimeter-damage`}
                      role="menuitem"
                      onClick={() => setDataMasterOpen(false)}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)] ${
                        isPerimeterDamageActive
                          ? "bg-[var(--rd-active)] text-[var(--rd-link)]"
                          : "hover:bg-[var(--rd-hover)] hover:text-[var(--rd-link)]"
                      }`}
                    >
                      <Fence
                        size={18}
                        strokeWidth={1.8}
                        className={`shrink-0 ${
                          isPerimeterDamageActive
                            ? "text-[var(--rd-link)]"
                            : "text-[var(--rd-muted)]"
                        }`}
                        aria-hidden="true"
                      />
                      <span className="block text-[13px] font-medium">
                        Kerusakan perimeter
                      </span>
                    </Link>
                    <Link
                      href={`/${locale}/dashboard/accounts`}
                      role="menuitem"
                      onClick={() => setDataMasterOpen(false)}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)] ${
                        isAccountsActive
                          ? "bg-[var(--rd-active)] text-[var(--rd-link)]"
                          : "hover:bg-[var(--rd-hover)] hover:text-[var(--rd-link)]"
                      }`}
                    >
                      <Users
                        size={18}
                        strokeWidth={1.8}
                        className={`shrink-0 ${
                          isAccountsActive
                            ? "text-[var(--rd-link)]"
                            : "text-[var(--rd-muted)]"
                        }`}
                        aria-hidden="true"
                      />
                      <span className="block text-[13px] font-medium">
                        Kelola akun
                      </span>
                    </Link>
                  </div>
                )}
              </div>
            </nav>
          )}
        </div>

        {/* Right: Theme, Notification Popover & User Account Menu */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <button
            type="button"
            onClick={onToggleTheme}
            className="grid size-9 place-items-center rounded-xl bg-transparent p-0 text-[var(--rd-text)] transition-colors hover:bg-[var(--rd-active)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)] sm:size-10"
            aria-label={dark ? "Aktifkan light mode" : "Aktifkan dark mode"}
          >
            {dark ? (
              <Sun size={21} strokeWidth={1.8} />
            ) : (
              <MoonStar size={21} strokeWidth={1.8} />
            )}
          </button>

          {/* Notification Bell with Shadcn Popover */}
          <Popover
            open={notifOpen}
            onOpenChange={(next) => {
              setNotifOpen(next);
              if (next) {
                setProfileOpen(false);
                setDataMasterOpen(false);
                onNotificationClick?.();
              }
            }}
          >
            <PopoverTrigger
              aria-label="Notifikasi"
              className={`relative grid size-9 place-items-center rounded-xl p-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)] sm:size-10 ${
                notifOpen
                  ? "bg-[var(--rd-active)] text-[var(--rd-link)]"
                  : "bg-transparent text-[var(--rd-text)] hover:bg-[var(--rd-active)]"
              }`}
            >
              <Bell size={20} strokeWidth={1.9} />
              {showUnreadDot && (
                <span
                  className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-[var(--rd-coral)] ring-2 ring-[var(--rd-panel)] sm:top-2 sm:right-2"
                  aria-hidden="true"
                />
              )}
            </PopoverTrigger>

            <PopoverContent
              align="end"
              sideOffset={10}
              className="w-[320px] p-0 sm:w-[360px]"
            >
              {/* Popover Header */}
              <PopoverHeader className="border-b border-solid border-[var(--rd-border)] px-4 pt-3.5 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <PopoverTitle className="text-sm font-semibold">
                      Notifikasi
                    </PopoverTitle>
                    {unreadCount > 0 && (
                      <span className="inline-flex items-center rounded-full bg-[var(--rd-coral)]/15 px-2 py-0.5 text-[11px] font-semibold text-[var(--rd-coral)]">
                        {unreadCount} baru
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--rd-link)] transition-colors hover:bg-[var(--rd-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)]"
                    >
                      <CheckCheck size={13} aria-hidden="true" />
                      <span>Tandai dibaca</span>
                    </button>
                  )}
                </div>

                {/* Filter Tabs */}
                <div className="mt-2.5 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNotifFilter("ALL")}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)] ${
                      notifFilter === "ALL"
                        ? "bg-[var(--rd-active)] text-[var(--rd-link)]"
                        : "text-[var(--rd-muted)] hover:bg-[var(--rd-hover)]"
                    }`}
                  >
                    Semua ({notifications.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotifFilter("UNREAD")}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)] ${
                      notifFilter === "UNREAD"
                        ? "bg-[var(--rd-active)] text-[var(--rd-link)]"
                        : "text-[var(--rd-muted)] hover:bg-[var(--rd-hover)]"
                    }`}
                  >
                    Belum dibaca ({unreadCount})
                  </button>
                </div>
              </PopoverHeader>

              {/* Notification List */}
              <div className="max-h-[320px] divide-y divide-[var(--rd-border)] overflow-y-auto overscroll-contain">
                {visibleNotifications.map((item) => {
                  const StatusIcon =
                    item.status === "RESOLVED"
                      ? ClipboardCheck
                      : item.status === "IN_PROGRESS"
                        ? ClipboardPen
                        : ClipboardClock;

                  const iconBadgeClass =
                    item.status === "RESOLVED"
                      ? "bg-[var(--rd-lime)]/15 text-[var(--rd-lime)]"
                      : item.status === "IN_PROGRESS"
                        ? "bg-[var(--rd-brown)]/15 text-[var(--rd-brown)]"
                        : "bg-[var(--rd-coral)]/15 text-[var(--rd-coral)]";

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectNotification(item.id)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--rd-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--rd-link)] ${
                        !item.read ? "bg-[var(--rd-active)]/35" : ""
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl ${iconBadgeClass}`}
                        aria-hidden="true"
                      >
                        <StatusIcon size={16} strokeWidth={2} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={`text-xs leading-snug ${
                              !item.read
                                ? "font-semibold text-[var(--rd-text)]"
                                : "font-medium text-[var(--rd-text)]"
                            }`}
                          >
                            {item.title}
                          </span>
                          {!item.read && (
                            <span
                              className="mt-1 size-2 shrink-0 rounded-full bg-[var(--rd-coral)]"
                              aria-label="Belum dibaca"
                            />
                          )}
                        </div>
                        <p className="m-0 mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-[var(--rd-muted)]">
                          {item.description}
                        </p>
                        <span className="mt-1 block text-[10px] text-[var(--rd-muted)]/85">
                          {item.time}
                        </span>
                      </div>
                    </button>
                  );
                })}

                {visibleNotifications.length === 0 && (
                  <div className="px-4 py-8 text-center">
                    <Bell
                      size={24}
                      strokeWidth={1.6}
                      className="mx-auto mb-2 text-[var(--rd-muted)]/60"
                      aria-hidden="true"
                    />
                    <p className="m-0 text-xs font-medium text-[var(--rd-text)]">
                      Tidak ada notifikasi
                    </p>
                    <p className="m-0 mt-0.5 text-[11px] text-[var(--rd-muted)]">
                      {notifFilter === "UNREAD"
                        ? "Semua pemberitahuan sudah dibaca."
                        : "Belum ada aktivitas terbaru."}
                    </p>
                  </div>
                )}
              </div>

              {/* Popover Footer */}
              <div className="border-t border-solid border-[var(--rd-border)] p-2">
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen(false);
                    router.push(
                      isOperator
                        ? `/${locale}/dashboard`
                        : `/${locale}/reports`
                    );
                  }}
                  className="block w-full rounded-xl py-2 text-center text-xs font-semibold text-[var(--rd-link)] transition-colors hover:bg-[var(--rd-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)]"
                >
                  {isOperator
                    ? "Lihat Semua Laporan Perimeter"
                    : "Buka Daftar Laporan Saya"}
                </button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Account Profile Trigger & Dropdown */}
          <div className="relative pl-0.5 sm:pl-1" ref={profileRef}>
            <button
              type="button"
              onClick={() => {
                setProfileOpen((prev) => !prev);
                setNotifOpen(false);
                setDataMasterOpen(false);
              }}
              aria-expanded={profileOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2.5 rounded-2xl p-1 text-left transition-colors hover:bg-[var(--rd-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)]"
            >
              {user ? (
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--rd-surface)] text-xs font-semibold tracking-wide text-[var(--rd-text)] shadow-xs sm:size-10 sm:rounded-2xl sm:text-sm"
                  title={displayName}
                  aria-label={displayName}
                >
                  {initialsOf(user)}
                </span>
              ) : (
                <Skeleton className="size-9 shrink-0 rounded-xl sm:size-10 sm:rounded-2xl" />
              )}
              <div className="hidden leading-tight sm:block">
                {user ? (
                  <strong className="block text-[13px] font-semibold text-[var(--rd-text)]">
                    {displayName}
                  </strong>
                ) : (
                  <Skeleton className="mb-1 h-3.5 w-24 rounded-md" />
                )}
                <span className="block text-[11px] text-[var(--rd-muted)]">
                  {roleLabel || "Pelapor"}
                </span>
              </div>
            </button>

            {/* Profile & Mobile Navigation Dropdown Menu */}
            {profileOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-[600] mt-2 w-60 rounded-2xl border border-[var(--rd-border)] bg-[var(--rd-surface)] p-2 text-[var(--rd-text)] shadow-xl animate-in fade-in zoom-in-95 duration-100"
              >
                {/* User Info on Mobile */}
                <div className="mb-1 border-b border-[var(--rd-border)] px-3 py-2 sm:hidden">
                  <p className="m-0 text-[13px] font-semibold text-[var(--rd-text)]">
                    {displayName}
                  </p>
                  <p className="m-0 mt-0.5 text-[11px] text-[var(--rd-muted)]">
                    {roleLabel || "Pelapor"}
                  </p>
                </div>

                {/* Operator Navigation on Mobile (< md) */}
                {isOperator && (
                  <div className="mb-1 border-b border-[var(--rd-border)] pb-1 md:hidden">
                    <Link
                      href={`/${locale}/dashboard`}
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)] ${
                        isDashboardHomeActive
                          ? "bg-[var(--rd-active)] text-[var(--rd-link)]"
                          : "hover:bg-[var(--rd-hover)]"
                      }`}
                    >
                      <SquareChartGantt
                        size={18}
                        strokeWidth={1.8}
                        className={`shrink-0 ${
                          isDashboardHomeActive
                            ? "text-[var(--rd-link)]"
                            : "text-[var(--rd-muted)]"
                        }`}
                        aria-hidden="true"
                      />
                      <span className="block text-[13px] font-medium">
                        Pantau Perimeter
                      </span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => setMobileDataMasterOpen((prev) => !prev)}
                      aria-expanded={mobileDataMasterOpen}
                      className="flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--rd-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)]"
                    >
                      <span className="flex items-center gap-2.5">
                        <Database
                          size={18}
                          strokeWidth={1.8}
                          className="shrink-0 text-[var(--rd-muted)]"
                          aria-hidden="true"
                        />
                        <span className="block text-[13px] font-medium text-[var(--rd-text)]">
                          Data Master
                        </span>
                      </span>
                      <ChevronDown
                        size={15}
                        className={`text-[var(--rd-muted)] transition-transform duration-200 ${
                          mobileDataMasterOpen ? "rotate-180" : ""
                        }`}
                        aria-hidden="true"
                      />
                    </button>

                    {mobileDataMasterOpen && (
                      <div className="mt-0.5 ml-4 space-y-0.5 border-l border-[var(--rd-border)] pl-2.5">
                        <Link
                          href={`/${locale}/dashboard/perimeter-damage`}
                          role="menuitem"
                          onClick={() => {
                            setMobileDataMasterOpen(false);
                            setProfileOpen(false);
                          }}
                          className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)] ${
                            isPerimeterDamageActive
                              ? "bg-[var(--rd-active)] text-[var(--rd-link)]"
                              : "hover:bg-[var(--rd-hover)]"
                          }`}
                        >
                          <Fence
                            size={16}
                            strokeWidth={1.8}
                            className={`shrink-0 ${
                              isPerimeterDamageActive
                                ? "text-[var(--rd-link)]"
                                : "text-[var(--rd-muted)]"
                            }`}
                            aria-hidden="true"
                          />
                          <span className="block text-xs font-medium">
                            Kerusakan perimeter
                          </span>
                        </Link>
                        <Link
                          href={`/${locale}/dashboard/accounts`}
                          role="menuitem"
                          onClick={() => {
                            setMobileDataMasterOpen(false);
                            setProfileOpen(false);
                          }}
                          className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)] ${
                            isAccountsActive
                              ? "bg-[var(--rd-active)] text-[var(--rd-link)]"
                              : "hover:bg-[var(--rd-hover)]"
                          }`}
                        >
                          <Users
                            size={16}
                            strokeWidth={1.8}
                            className={`shrink-0 ${
                              isAccountsActive
                                ? "text-[var(--rd-link)]"
                                : "text-[var(--rd-muted)]"
                            }`}
                            aria-hidden="true"
                          />
                          <span className="block text-xs font-medium">
                            Kelola akun
                          </span>
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setProfileOpen(false)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--rd-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)]"
                >
                  <User
                    size={18}
                    strokeWidth={1.8}
                    className="shrink-0 text-[var(--rd-muted)]"
                    aria-hidden="true"
                  />
                  <span className="block text-[13px] font-medium">
                    Profil saya
                  </span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[var(--rd-coral)] transition-colors hover:bg-[var(--rd-coral)]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-coral)]"
                >
                  <LogOut
                    size={18}
                    strokeWidth={1.8}
                    className="shrink-0"
                    aria-hidden="true"
                  />
                  <span className="block text-[13px] font-medium">
                    Keluar
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
