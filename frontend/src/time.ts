import { dayLabel } from './filters';

const shortDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const timeOfDay = (date: Date) => date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

// Grouped lists already say the day in a heading, so they only need the time; a flat list says it
// on every row. Older tasks always show the date.
export function formatCreated(createdAt: string, grouped: boolean, now = new Date()): string {
  const date = new Date(createdAt);
  const label = dayLabel(createdAt, now);
  if (label === 'Earlier') return shortDate(date);
  return grouped ? timeOfDay(date) : `${label}, ${timeOfDay(date)}`;
}
