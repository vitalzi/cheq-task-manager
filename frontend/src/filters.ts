import type { Task } from './api';

export type Status = 'all' | 'open' | 'done';

export interface Filters {
  query: string;
  status: Status;
}

export const NO_FILTERS: Filters = { query: '', status: 'all' };

export const isFiltering = ({ query, status }: Filters) => query.trim() !== '' || status !== 'all';

export function applyFilters(tasks: Task[], { query, status }: Filters): Task[] {
  const needle = query.trim().toLowerCase();
  return tasks.filter((task) => {
    if (status === 'open' && task.done === 1) return false;
    if (status === 'done' && task.done === 0) return false;
    return needle === '' || task.title.toLowerCase().includes(needle);
  });
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

// By the viewer's local calendar day, newest first. Empty groups are left out.
export function groupByDay(tasks: Task[], now = new Date()): DayGroup[] {
  const newestFirst = [...tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (['Today', 'Yesterday', 'Earlier'] as const)
    .map((label) => ({ label, tasks: newestFirst.filter((task) => dayLabel(task.createdAt, now) === label) }))
    .filter((group) => group.tasks.length > 0);
}

export function headingFor(tasks: Task[], shown: number, filters: Filters): string {
  if (tasks.length === 0) return 'No tasks yet';
  if (isFiltering(filters)) return `${shown} of ${tasks.length} tasks`;
  const open = tasks.filter((task) => task.done === 0).length;
  if (open === 0) return 'All done';
  return open === 1 ? '1 open task' : `${open} open tasks`;
}
