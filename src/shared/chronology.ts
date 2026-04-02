export type ChronologyValue = string;

export const CHRONOLOGY_FORMAT_HINT = 'Use YYYY, YYYYMM, or YYYYMMDD.';

function coerceChronologyInput(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value)) {
    return String(value);
  }

  return '';
}

export function getChronologyValidationError(value: unknown) {
  const candidate = coerceChronologyInput(value);
  if (!candidate) {
    return 'Chronology is required.';
  }

  if (!/^\d{4}(?:\d{2}(?:\d{2})?)?$/.test(candidate)) {
    return CHRONOLOGY_FORMAT_HINT;
  }

  if (candidate.length >= 6) {
    const month = Number(candidate.slice(4, 6));
    if (month < 1 || month > 12) {
      return 'Month must be between 01 and 12.';
    }
  }

  if (candidate.length === 8) {
    const year = Number(candidate.slice(0, 4));
    const month = Number(candidate.slice(4, 6));
    const day = Number(candidate.slice(6, 8));
    const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

    if (day < 1 || day > maxDay) {
      return 'Day must be valid for the selected month.';
    }
  }

  return null;
}

export function isValidChronologyValue(value: unknown): value is ChronologyValue {
  return getChronologyValidationError(value) === null;
}

export function normalizeChronologyValue(value: unknown): ChronologyValue {
  const candidate = coerceChronologyInput(value);
  const error = getChronologyValidationError(candidate);

  if (error) {
    throw new Error(error);
  }

  return candidate;
}

export function getChronologySortKey(value: unknown) {
  return Number(normalizeChronologyValue(value).padEnd(8, '0'));
}

export function getChronologySortKeySafe(value: unknown, fallback = Number.NEGATIVE_INFINITY) {
  try {
    return getChronologySortKey(value);
  } catch {
    return fallback;
  }
}

export function getCurrentMonthChronologyValue() {
  return new Date().toISOString().slice(0, 7).replace('-', '');
}
