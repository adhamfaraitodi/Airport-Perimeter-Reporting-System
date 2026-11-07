import { useParams } from "next/navigation";
import { id } from "./dictionaries/id";
import { en } from "./dictionaries/en";

export type TranslationDictionary = typeof id;
export type SupportedLocale = "id" | "en";

export const dictionaries: Record<SupportedLocale, TranslationDictionary> = {
  id,
  en,
};

export function getDictionary(locale?: string): TranslationDictionary {
  if (locale === "en") return dictionaries.en;
  return dictionaries.id;
}

/**
 * Client hook that automatically grabs the current locale from Next.js useParams
 * and returns the typed dictionary object.
 */
export function useTranslation() {
  const params = useParams<{ locale?: string }>();
  const locale: SupportedLocale = params?.locale === "en" ? "en" : "id";
  const t = getDictionary(locale);

  return {
    t,
    locale,
    isEn: locale === "en",
    isId: locale === "id",
  };
}
