/**
 * All Turkish formatting lives here.
 *
 * Money is present as a formatter but has no caller in this version: every
 * programme's `published_reference` is null, and a published ceiling is not an
 * amount anyone will receive. The formatter exists so that when a ceiling does
 * appear it is formatted correctly - not so a total can be invented.
 */

const LOCALE = "tr-TR";

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const numberFormatter = new Intl.NumberFormat(LOCALE);

const relativeFormatter = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });

export function formatDate(value: string | null | undefined): string {
  if (!value) return "Bilinmiyor";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Bilinmiyor";
  return dateFormatter.format(parsed);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Bilinmiyor";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Bilinmiyor";
  return dateTimeFormatter.format(parsed);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return numberFormatter.format(value);
}

/** "3 gün önce". Used for source freshness, never for deadlines. */
export function formatRelativeDays(value: string | null | undefined, now = new Date()): string {
  if (!value) return "Bilinmiyor";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Bilinmiyor";
  const days = Math.round((parsed.getTime() - now.getTime()) / 86_400_000);
  return relativeFormatter.format(days, "day");
}

export function daysSince(value: string | null | undefined, now = new Date()): number | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - parsed.getTime()) / 86_400_000));
}

/**
 * Currency formatter. Deliberately unused by any decision surface - see the
 * module docstring. Kept so that formatting is consistent when a published
 * ceiling eventually exists.
 */
export function formatPublishedCeiling(minorUnits: number, currency = "TRY"): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(minorUnits / 100);
}

export function pluralTr(count: number, singular: string): string {
  return `${formatNumber(count)} ${singular}`;
}
