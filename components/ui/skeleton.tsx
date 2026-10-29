import * as React from "react";

function Skeleton({ className = "", ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={`animate-pulse rounded-xl bg-[var(--rd-border,#e5e9eb)]/80 ${className}`}
      {...props}
    />
  );
}

export { Skeleton };
