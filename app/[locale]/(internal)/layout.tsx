import type { ReactNode } from "react";

export default function InternalLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen flex flex-col">{children}</div>;
}
