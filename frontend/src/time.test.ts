import { describe, expect, it } from 'vitest';
import { formatCreated } from './time';

const now = new Date(2026, 10, 3, 12, 0); // 3 Nov 2026, local noon
const iso = (month: number, day: number, hour: number, minute = 0) => new Date(2026, month, day, hour, minute).toISOString();

describe('formatCreated', () => {
  it('grouped: the time of day for today and yesterday, the date for older tasks', () => {
    expect(formatCreated(iso(10, 3, 9, 30), true, now)).toBe('09:30');
    expect(formatCreated(iso(10, 2, 18, 5), true, now)).toBe('18:05');
    expect(formatCreated(iso(9, 31, 16, 20), true, now)).toBe('Oct 31');
  });

  it('flat: says which day for today and yesterday, since there are no group headings', () => {
    expect(formatCreated(iso(10, 3, 9, 30), false, now)).toBe('Today, 09:30');
    expect(formatCreated(iso(10, 2, 18, 5), false, now)).toBe('Yesterday, 18:05');
    expect(formatCreated(iso(9, 31, 16, 20), false, now)).toBe('Oct 31');
  });
});
