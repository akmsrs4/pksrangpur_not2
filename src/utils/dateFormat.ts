/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Converts a stored date string (ISO, `YYYY-MM-DD HH:MM`, or `YYYY-MM-DD`) into
 * a browser `<input type="datetime-local">` value (`YYYY-MM-DDTHH:MM`).
 */
export function toDateTimeLocalValue(raw?: string): string {
  if (!raw || !raw.trim()) return '';
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const parsed = new Date(trimmed.includes(' ') && !trimmed.includes('T') ? trimmed.replace(' ', 'T') : trimmed);
  if (Number.isNaN(parsed.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

/**
 * Converts a `<input type="datetime-local">` or date string into a valid PostgreSQL TIMESTAMPTZ ISO string.
 */
export function toIsoTimestamp(raw?: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return new Date().toISOString();
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(trimmed) ? trimmed.replace(' ', 'T') : trimmed;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

/**
 * Formats an event timestamp safely into readable Bengali date & time.
 * Gracefully falls back to raw text for any legacy non-ISO string.
 */
export function formatEventDateBn(raw?: string): string {
  if (!raw || !raw.trim()) return '';
  const trimmed = raw.trim();
  // Only auto-format strings that look like ISO/SQL dates (avoid mangling legacy Bengali text)
  if (!/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed;
  }
  const normalized = trimmed.includes(' ') && !trimmed.includes('T') ? trimmed.replace(' ', 'T') : trimmed;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  try {
    return new Intl.DateTimeFormat('bn-BD', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(parsed);
  } catch {
    return parsed.toLocaleString();
  }
}
