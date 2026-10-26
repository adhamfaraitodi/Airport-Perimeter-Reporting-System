import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "../../proxy";

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  // Jika locale tidak valid, lempar ke default locale ('id')
  if (!SUPPORTED_LOCALES.includes(locale as SupportedLocale)) {
    redirect(`/${DEFAULT_LOCALE}/reports`);
  }

  return (
    <div data-locale={locale} className="min-h-screen flex flex-col">
      {children}
    </div>
  );
}
