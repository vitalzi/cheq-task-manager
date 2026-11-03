import { describe, expect, it } from 'vitest';
import { applyFilters, groupByDay, headingFor, NO_FILTERS } from './filters';
import { sampleTask } from './test/fakeApi';

const now = new Date(2026, 10, 3, 12, 0); // 3 Nov 2026, local noon
const at = (day: number, hour: number, month = 10) => new Date(2026, month, day, hour).toISOString();

describe('applyFilters', () => {
  const tasks = [
    sampleTask({ id: 'a', title: 'Write the README', done: 0 }),
    sampleTask({ id: 'b', title: 'Record a demo', done: 1 }),
  ];

  it('keeps everything with no filters', () => {
    expect(applyFilters(tasks, NO_FILTERS)).toEqual(tasks);
  });

  it('matches the title case-insensitively and ignores surrounding spaces in the query', () => {
    expect(applyFilters(tasks, { query: '  readme ', status: 'all' }).map((t) => t.id)).toEqual(['a']);
  });

  it('keeps only open or only done tasks', () => {
    expect(applyFilters(tasks, { query: '', status: 'open' }).map((t) => t.id)).toEqual(['a']);
    expect(applyFilters(tasks, { query: '', status: 'done' }).map((t) => t.id)).toEqual(['b']);
  });
});

describe('groupByDay', () => {
  it('groups by local calendar day, newest first, and leaves empty groups out', () => {
    const groups = groupByDay(
      [
        sampleTask({ id: 'old', createdAt: at(20, 9, 9) }),
        sampleTask({ id: 'today-early', createdAt: at(3, 8) }),
        sampleTask({ id: 'today-late', createdAt: at(3, 11) }),
        sampleTask({ id: 'yesterday', createdAt: at(2, 23) }),
      ],
      now,
    );

    expect(groups.map((g) => [g.label, g.tasks.map((t) => t.id)])).toEqual([
      ['Today', ['today-late', 'today-early']],
      ['Yesterday', ['yesterday']],
      ['Earlier', ['old']],
    ]);
  });

  it('returns no groups for no tasks', () => {
    expect(groupByDay([], now)).toEqual([]);
  });
});

describe('headingFor', () => {
  const open = (n: number) => Array.from({ length: n }, (_, i) => sampleTask({ id: `o${i}`, done: 0 }));
  const done = sampleTask({ id: 'd', done: 1 });

  it.each([
    [[], 0, 'No tasks yet'],
    [[done], 1, 'All done'],
    [[...open(1), done], 2, '1 open task'],
    [[...open(3), done], 4, '3 open tasks'],
  ])('counts open tasks when not filtering (%#)', (tasks, shown, expected) => {
    expect(headingFor(tasks, shown, NO_FILTERS)).toBe(expected);
  });

  it('says how many of the total are shown while filtering', () => {
    expect(headingFor([...open(3), done], 2, { query: 'x', status: 'all' })).toBe('2 of 4 tasks');
    expect(headingFor([...open(3), done], 1, { query: '', status: 'done' })).toBe('1 of 4 tasks');
  });
});
