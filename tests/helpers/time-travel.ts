/**
 * Time and timezone helper functions for Asia/Kolkata date math and overdue logic testing.
 * Adheres strictly to HOSPITAL_FOLLOWUP_BUILD_SPEC.md §6.3, §12.
 */

export const ASIA_KOLKATA = 'Asia/Kolkata';

/**
 * Normalizes an arbitrary Date or ISO string into an ISO date string (YYYY-MM-DD)
 * anchored specifically to the Asia/Kolkata calendar day.
 */
export function toKolkataCalendarDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Format to YYYY-MM-DD in Asia/Kolkata timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: ASIA_KOLKATA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  return formatter.format(d);
}

/**
 * Computes calendar day difference between two dates in Asia/Kolkata timezone.
 */
export function getCalendarDayDiff(fromDateStr: string, toDateStr: string): number {
  const p1 = fromDateStr.split('-').map(Number);
  const p2 = toDateStr.split('-').map(Number);
  const y1 = p1[0] ?? 2026;
  const m1 = p1[1] ?? 1;
  const d1 = p1[2] ?? 1;
  const y2 = p2[0] ?? 2026;
  const m2 = p2[1] ?? 1;
  const d2 = p2[2] ?? 1;

  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);

  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.round((utc2 - utc1) / MS_PER_DAY);
}

/**
 * Determines whether a follow-up is confirmed overdue based on appointment date
 * and current evaluation date in Asia/Kolkata.
 * Returns null if not overdue, or the overdue stage (+2 or +4).
 */
export function evaluateOverdueStage(
  appointmentDateStr: string,
  currentKolkataDateStr: string
): 'OVERDUE_STAGE_1' | 'OVERDUE_STAGE_2' | 'PENDING' | 'NOT_OVERDUE' {
  const diff = getCalendarDayDiff(appointmentDateStr, currentKolkataDateStr);

  if (diff < 2) {
    return 'NOT_OVERDUE';
  } else if (diff >= 2 && diff < 4) {
    return 'OVERDUE_STAGE_1'; // +2 calendar days
  } else if (diff >= 4) {
    return 'OVERDUE_STAGE_2'; // +4 calendar days
  }

  return 'PENDING';
}
