import type { ReactNode } from "react";

export default function TechnicianLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <section className="flex flex-1 flex-col">{children}</section>;
}
