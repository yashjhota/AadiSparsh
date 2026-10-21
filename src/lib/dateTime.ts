/**
 * Aadi Sparsh — Timezone and Date Utility Module
 * Guarantees precise Asia/Kolkata date and cutoff calculations.
 * Avoids UTC date-conversion errors and DST offsets.
 */

export const TEMPLE_TIMEZONE = 'Asia/Kolkata';

export interface KolkataNow {
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:MM:SS
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * Returns current timestamp in Asia/Kolkata as structured components and strings.
 */
export const getKolkataNow = (): KolkataNow => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TEMPLE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const dateStr = `${partMap.year}-${partMap.month}-${partMap.day}`;
  const timeStr = `${partMap.hour}:${partMap.minute}:${partMap.second}`;

  return {
    dateStr,
    timeStr,
    year: Number(partMap.year),
    month: Number(partMap.month),
    day: Number(partMap.day),
    hour: Number(partMap.hour),
    minute: Number(partMap.minute),
    second: Number(partMap.second),
  };
};

/**
 * Safely parses YYYY-MM-DD into a midday Date object to prevent UTC midnight rollover.
 */
export const parseLocalDate = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
};

/**
 * Formats a Date object to YYYY-MM-DD using local year/month/day.
 */
export const formatDateStr = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Formats date to graceful human-readable string: e.g. "Sunday, 25 October 2026"
 */
export const formatDisplayDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  return dt.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * Formats date to short format: e.g. "25 Oct 2026"
 */
export const formatShortDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  return dt.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Computes tomorrow's date string in Asia/Kolkata
 */
export const getKolkataTomorrowStr = (): string => {
  const now = getKolkataNow();
  const dt = parseLocalDate(now.dateStr);
  dt.setDate(dt.getDate() + 1);
  return formatDateStr(dt);
};
