"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "../_lib/use-theme";

export interface StartupScreenProps {
  loading: boolean;
  error: string;
}

/** Shown while the session/page is being resolved, or when it fails to load. */
export function StartupScreen({ loading, error }: StartupScreenProps) {
  const { theme } = useTheme();

  if (!loading && error) {
    return (
      <main
        className="operator-dashboard flex min-h-dvh items-center justify-center bg-[var(--rd-bg)] p-6 text-[var(--rd-text)]"
        data-theme={theme}
      >
        <div
          role="alert"
          className="w-full max-w-[440px] rounded-xl border border-solid border-[var(--rd-coral)]/35 bg-[var(--rd-coral)]/10 p-4 text-left text-xs leading-relaxed text-[var(--rd-coral)] [overflow-wrap:anywhere]"
        >
          {error}
        </div>
      </main>
    );
  }

  return (
    <div
      className="operator-dashboard flex min-h-dvh flex-col bg-[var(--rd-bg)] text-[var(--rd-text)]"
      data-theme={theme}
      role="status"
      aria-label="Memuat halaman"
    >
      {/* Header Skeleton */}
      <header className="border-b border-[var(--rd-border)] bg-[var(--rd-panel)]">
        <div className="mx-auto flex h-[72px] max-w-[1700px] items-center justify-between gap-3 px-4 sm:h-[86px] sm:px-8 min-[1100px]:px-[5%]">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-20 rounded-lg sm:h-10 sm:w-24" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-28 rounded-md sm:w-36" />
                <Skeleton className="h-3 w-24 rounded-md sm:w-28" />
              </div>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <Skeleton className="h-9 w-36 rounded-xl" />
              <Skeleton className="h-9 w-32 rounded-xl" />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Skeleton className="size-9 rounded-xl sm:size-10" />
            <Skeleton className="size-9 rounded-xl sm:size-10" />
            <div className="flex items-center gap-2.5 pl-1">
              <Skeleton className="size-9 rounded-xl sm:size-10 sm:rounded-2xl" />
              <div className="hidden space-y-1.5 sm:block">
                <Skeleton className="h-3.5 w-24 rounded-md" />
                <Skeleton className="h-2.5 w-16 rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Skeleton */}
      <main className="mx-auto flex w-full max-w-[1700px] flex-1 flex-col px-3 pt-4 md:px-[3%] md:pt-6 min-[1100px]:px-[5%]">
        {/* Breadcrumb Skeleton */}
        <div className="mb-3 flex items-center gap-2">
          <Skeleton className="h-3.5 w-16 rounded-md" />
          <Skeleton className="h-3.5 w-28 rounded-md" />
        </div>

        {/* Title & Action Skeleton */}
        <div className="mb-[18px] flex items-center justify-between gap-4 md:mb-[30px]">
          <div className="space-y-2">
            <Skeleton className="h-7 w-56 rounded-lg sm:h-8 sm:w-72" />
            <Skeleton className="hidden h-4 w-96 rounded-md md:block" />
          </div>
          <Skeleton className="h-10 w-12 rounded-[10px]" />
        </div>

        {/* Main Workspace / Grid Skeleton */}
        <div className="flex flex-1 flex-col gap-3 pb-6 md:grid md:grid-cols-[minmax(0,1fr)_400px] min-[1100px]:grid-cols-[minmax(0,1fr)_580px] min-[1100px]:gap-5">
          <Skeleton className="min-h-[340px] flex-1 rounded-[14px]" />
          <div className="flex flex-col gap-4 rounded-[14px] border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-5">
            <Skeleton className="h-6 w-40 rounded-md" />
            <Skeleton className="h-11 w-full rounded-lg" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-16 rounded-xl" />
              <Skeleton className="h-8 w-16 rounded-xl" />
              <Skeleton className="h-8 w-20 rounded-xl" />
              <Skeleton className="h-8 w-16 rounded-xl" />
            </div>
            <div className="space-y-3 pt-2">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
