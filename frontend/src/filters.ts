import type { Task } from './api';

export type Status = 'open' | 'done' | 'all';

export interface Filters {
  query: string;
  status: Status;
}

export const DEFAULT_FILTERS: Filters = { query: '', status: 'open' };

export function applyFilters(tasks: Task[], { query, status }: Filters): Task[] {
  const needle = query.trim().toLowerCase();
  return tasks.filter((task) => {
    if (status === 'open' && task.done === 1) return false;
    if (status === 'done' && task.done === 0) return false;
    return needle === '' || task.title.toLowerCase().includes(needle);
  });
}

// Totals per tab; the search does not change them.
export function statusCounts(tasks: Task[]): Record<Status, number> {
  const done = tasks.filter((task) => task.done === 1).length;
  return { open: tasks.length - done, done, all: tasks.length };
}

// Open tasks first, then done ones; each part newest first.
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => a.done - b.done || b.createdAt.localeCompare(a.createdAt));
}

export type DayLabel = 'Today' | 'Yesterday' | 'Earlier';

export interface DayGroup {
  label: DayLabel;
  tasks: Task[];
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export function dayLabel(createdAt: string, now: Date): DayLabel {
  const daysAgo = Math.round((startOfDay(now) - startOfDay(new Date(createdAt))) / 86_400_000);
  return daysAgo <= 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : 'Earlier';
}

// By the viewer's local calendar day. Empty groups are left out.
export function groupByDay(tasks: Task[], now = new Date()): DayGroup[] {
  return (['Today', 'Yesterday', 'Earlier'] as const)
    .map((label) => ({ label, tasks: sortTasks(tasks.filter((task) => dayLabel(task.createdAt, now) === label)) }))
    .filter((group) => group.tasks.length > 0);
}
