import { describe, expect, it } from 'vitest';
import { applyFilters, DEFAULT_FILTERS, groupByDay, sortTasks, statusCounts } from './filters';
import { sampleTask } from './test/fakeApi';

const now = new Date(2026, 10, 3, 12, 0); // 3 Nov 2026, local noon
const at = (day: number, hour: number, month = 10) => new Date(2026, month, day, hour).toISOString();

describe('DEFAULT_FILTERS', () => {
  it('starts on the Open tab with no search', () => {
    expect(DEFAULT_FILTERS).toEqual({ query: '', status: 'open' });
  });
});

describe('applyFilters', () => {
  const tasks = [
    sampleTask({ id: 'a', title: 'Write the README', done: 0 }),
    sampleTask({ id: 'b', title: 'Record a demo', done: 1 }),
  ];

  it('keeps everything on the All tab with no search', () => {
    expect(applyFilters(tasks, { query: '', status: 'all' })).toEqual(tasks);
  });

  it('matches the title case-insensitively and ignores surrounding spaces in the query', () => {
    expect(applyFilters(tasks, { query: '  readme ', status: 'all' }).map((t) => t.id)).toEqual(['a']);
  });

  it('keeps only open or only done tasks', () => {
    expect(applyFilters(tasks, { query: '', status: 'open' }).map((t) => t.id)).toEqual(['a']);
    expect(applyFilters(tasks, { query: '', status: 'done' }).map((t) => t.id)).toEqual(['b']);
  });
});

describe('statusCounts', () => {
  it('counts the tasks per tab', () => {
    const tasks = [sampleTask({ id: 'a', done: 0 }), sampleTask({ id: 'b', done: 0 }), sampleTask({ id: 'c', done: 1 })];
    expect(statusCounts(tasks)).toEqual({ open: 2, done: 1, all: 3 });
  });
});

describe('sortTasks', () => {
  it('puts open tasks first, then done ones, each part newest first', () => {
    const sorted = sortTasks([
      sampleTask({ id: 'done-new', done: 1, createdAt: at(3, 11) }),
      sampleTask({ id: 'open-old', done: 0, createdAt: at(1, 9) }),
      sampleTask({ id: 'done-old', done: 1, createdAt: at(1, 8) }),
      sampleTask({ id: 'open-new', done: 0, createdAt: at(2, 9) }),
    ]);

    expect(sorted.map((t) => t.id)).toEqual(['open-new', 'open-old', 'done-new', 'done-old']);
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

  it('puts done tasks after open ones inside each group', () => {
    const [today] = groupByDay(
      [sampleTask({ id: 'done', done: 1, createdAt: at(3, 11) }), sampleTask({ id: 'open', done: 0, createdAt: at(3, 8) })],
      now,
    );

    expect(today.tasks.map((t) => t.id)).toEqual(['open', 'done']);
  });

  it('returns no groups for no tasks', () => {
    expect(groupByDay([], now)).toEqual([]);
  });
});
