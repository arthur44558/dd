/**
 * Unit Test Suite: Asia/Kolkata Calendar Math & Overdue Trigger Logic.
 * Adheres strictly to HOSPITAL_FOLLOWUP_BUILD_SPEC.md §6.3, §12.
 */

import { describe, it, expect } from 'vitest';
import { calculateOverdueDates } from '../fixtures/schedule-rules';
import { evaluateOverdueStage, toKolkataCalendarDate } from '../helpers/time-travel';

describe('Asia/Kolkata Calendar Math & Overdue Trigger Logic', () => {
  describe('calculateOverdueDates', () => {
    it('accurately calculates +2 and +4 calendar days for standard intra-month dates', () => {
      const dates = calculateOverdueDates('2026-11-10');
      expect(dates.appointmentDate).toBe('2026-11-10');
      expect(dates.overdueTask1Date).toBe('2026-11-12'); // Exactly +2 calendar days
      expect(dates.overdueTask2Date).toBe('2026-11-14'); // Exactly +4 calendar days
    });

    it('accurately handles 31-day month crossover (October 31 -> November)', () => {
      const dates = calculateOverdueDates('2026-10-31');
      expect(dates.overdueTask1Date).toBe('2026-11-02'); // +2 days crosses into November
      expect(dates.overdueTask2Date).toBe('2026-11-04'); // +4 days
    });

    it('accurately handles 30-day month crossover (April 29 -> May)', () => {
      const dates = calculateOverdueDates('2026-04-29');
      expect(dates.overdueTask1Date).toBe('2026-05-01'); // 30 April, 1 May
      expect(dates.overdueTask2Date).toBe('2026-05-03');
    });

    it('accurately handles year-end boundary (December 30 -> January)', () => {
      const dates = calculateOverdueDates('2026-12-30');
      expect(dates.overdueTask1Date).toBe('2027-01-01'); // Crosses year into 2027
      expect(dates.overdueTask2Date).toBe('2027-01-03');
    });

    it('accurately handles February in non-leap year (Feb 27 -> March)', () => {
      const dates = calculateOverdueDates('2027-02-27');
      expect(dates.overdueTask1Date).toBe('2027-03-01'); // 28 Feb, 1 March
      expect(dates.overdueTask2Date).toBe('2027-03-03');
    });
  });

  describe('evaluateOverdueStage & Midnight Triggers', () => {
    const appointmentDate = '2026-11-10';

    it('evaluates as NOT_OVERDUE on appointment date and +1 day', () => {
      expect(evaluateOverdueStage(appointmentDate, '2026-11-10')).toBe('NOT_OVERDUE');
      expect(evaluateOverdueStage(appointmentDate, '2026-11-11')).toBe('NOT_OVERDUE');
    });

    it('triggers OVERDUE_STAGE_1 at exactly +2 calendar days', () => {
      expect(evaluateOverdueStage(appointmentDate, '2026-11-12')).toBe('OVERDUE_STAGE_1');
    });

    it('maintains OVERDUE_STAGE_1 at +3 calendar days', () => {
      expect(evaluateOverdueStage(appointmentDate, '2026-11-13')).toBe('OVERDUE_STAGE_1');
    });

    it('triggers OVERDUE_STAGE_2 at exactly +4 calendar days', () => {
      expect(evaluateOverdueStage(appointmentDate, '2026-11-14')).toBe('OVERDUE_STAGE_2');
    });

    it('maintains STAGE_2 at +5 days without creating additional automated stages (capped at 2 tasks)', () => {
      // Per Spec §6.3: "no further automatic overdue texts"
      expect(evaluateOverdueStage(appointmentDate, '2026-11-15')).toBe('OVERDUE_STAGE_2');
      expect(evaluateOverdueStage(appointmentDate, '2026-11-20')).toBe('OVERDUE_STAGE_2');
    });

    it('formats UTC timestamps to the correct Asia/Kolkata calendar day', () => {
      // 2026-11-10T19:00:00Z is 00:30 AM on 2026-11-11 in Asia/Kolkata (UTC + 5:30)
      const lateUtc = new Date('2026-11-10T19:00:00Z');
      expect(toKolkataCalendarDate(lateUtc)).toBe('2026-11-11');
    });
  });
});
