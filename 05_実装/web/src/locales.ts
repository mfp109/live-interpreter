export const localeOptions = [
  ["ja", "日本語"],
  ["en", "English"],
  ["zh-CN", "中文"],
  ["es", "Español"],
  ["pt", "Português"],
  ["fr", "Français"],
  ["de", "Deutsch"],
  ["ru", "Русский"],
  ["ko", "한국어"],
  ["hi", "हिन्दी"],
  ["id", "Bahasa Indonesia"],
  ["vi", "Tiếng Việt"],
  ["it", "Italiano"],
] as const;

export type Locale = (typeof localeOptions)[number][0];

export function isLocale(value: string | null): value is Locale {
  return localeOptions.some(([code]) => code === value);
}

export function localeFallback<T>(
  values: Partial<Record<Locale, T>>,
  locale: Locale,
): T {
  return values[locale] ?? values.en ?? values.ja!;
}
