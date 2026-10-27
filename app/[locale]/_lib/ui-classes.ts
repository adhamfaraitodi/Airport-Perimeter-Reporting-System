/**
 * Shared Tailwind class recipes.
 *
 * All colors resolve through the `--rd-*` design tokens declared in
 * `app/globals.css`, so these recipes work in light and dark themes as long
 * as an ancestor carries `.reporter-dashboard` or `.operator-dashboard`.
 */

export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)]";

export const btnBase = `inline-flex items-center justify-center gap-1.5 rounded-lg border border-solid border-transparent font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${focusRing}`;

export const btnPrimary = `${btnBase} min-h-10 bg-[var(--rd-primary)] px-4 py-2 text-sm text-white hover:bg-[var(--rd-primary-hover)]`;

export const btnSecondary = `${btnBase} min-h-10 border-[var(--rd-border)] bg-[var(--rd-surface)] px-4 py-2 text-sm text-[var(--rd-text)] hover:bg-[var(--rd-hover)]`;

export const btnDanger = `${btnBase} min-h-10 bg-[var(--rd-coral)] px-4 py-2 text-sm text-white hover:brightness-95`;

export const btnDangerGhost = `${btnBase} min-h-10 border-[var(--rd-coral)]/35 bg-[var(--rd-surface)] px-4 py-2 text-sm text-[var(--rd-coral)] hover:bg-[var(--rd-coral)]/10`;

export const btnText = `${btnBase} min-h-9 bg-transparent px-0 py-1 text-xs font-normal text-[var(--rd-link)] hover:underline`;

export const btnIcon = `${btnBase} size-10 min-h-10 bg-[var(--rd-bg)] p-0 text-[var(--rd-muted)] hover:bg-[var(--rd-active)] hover:text-[var(--rd-link)]`;

export const fieldLabel = "mb-[18px] block text-xs font-semibold";

export const fieldControl =
  "mt-2 block min-h-11 w-full rounded-lg border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-3 text-sm font-normal text-[var(--rd-text)] placeholder:text-[var(--rd-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)]";

export const mutedText = "text-xs leading-relaxed text-[var(--rd-muted)]";

export const eyebrow =
  "mb-2 block text-[8px] font-bold tracking-[1.3px] text-[var(--rd-muted)] sm:mb-3 sm:text-[10px] sm:tracking-[1.8px]";

export const alertBox =
  "mb-4 rounded-lg border border-solid border-[var(--rd-coral)]/35 bg-[var(--rd-coral)]/10 p-3.5 text-xs leading-relaxed text-[var(--rd-coral)] [overflow-wrap:anywhere]";

export const statusPill =
  "rd-status inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[var(--rd-tint)] px-2 py-0.5 text-[10px] font-semibold text-[var(--rd-status)]";
