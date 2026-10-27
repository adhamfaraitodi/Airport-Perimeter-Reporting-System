"use client";

import { useEffect, useState } from "react";
import { Copyright } from "lucide-react";

const timeFormat = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Asia/Jakarta",
});

/** Live clock in Western Indonesia Time, rendered only after mount. */
function WibClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <time
      dateTime={now?.toISOString()}
      className="shrink-0 tabular-nums tracking-normal"
      aria-label="Waktu sekarang (WIB)"
    >
      {now ? timeFormat.format(now) : "--.--.--"} WIB
    </time>
  );
}

export function ReportFooter() {
  return (
    <footer className="flex items-center justify-between gap-2.5 py-[22px] text-[8px] tracking-[1px] text-[var(--rd-muted)] md:py-[27px] md:text-[9px]">
      <span className="flex min-w-0 items-center gap-1">
        <Copyright size={12} aria-hidden="true" className="shrink-0" />
        <span>2026 Airport Perimeter Reporting System 1.0v</span>
      </span>
      <WibClock />
    </footer>
  );
}
