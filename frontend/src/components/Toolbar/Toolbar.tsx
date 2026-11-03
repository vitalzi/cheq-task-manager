import { PRIORITIES, type Priority } from '../../api/api';
import { statusCounts, type Filters, type Status } from '../../lib/filters';
import { useTasks } from '../../api/useTasks';
import { ChevronDownIcon, SearchIcon } from '../Icons/Icons';
import styles from './Toolbar.module.css';

const STATUSES: { value: Status; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'done', label: 'Done' },
  { value: 'all', label: 'All' },
];

const PRIORITY_CLASS = ['high', 'medium', 'low'] as const;

interface Props {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  byDay: boolean;
  onByDayChange: (byDay: boolean) => void;
}

export function Toolbar({ filters, onFiltersChange, byDay, onByDayChange }: Props) {
  const { data } = useTasks();
  const counts = data ? statusCounts(data) : null; // no counts until the tasks have loaded

  return (
    <div className={styles.toolbar}>
      <div className={styles.filters} role="group" aria-label="Filters">
        <label className={styles.filter}>
          <span className={styles.filterLabel}>Status</span>
          <select
            className={`${styles.select} ${styles.statusSelect} ${filters.status !== 'open' ? styles.active : ''}`}
            aria-label="Status"
            value={filters.status}
            onChange={(e) => onFiltersChange({ ...filters, status: e.target.value as Status })}
          >
            {STATUSES.map(({ value, label }) => (
              <option key={value} value={value}>
                {counts ? `${label} · ${counts[value]}` : label}
              </option>
            ))}
          </select>
          <ChevronDownIcon className={styles.chevron} />
        </label>
        <label className={styles.filter}>
          <span className={styles.filterLabel}>Priority</span>
          <select
            className={`${styles.select} ${styles.prioritySelect} ${filters.priority !== 'any' ? styles.active : ''} ${
              filters.priority === 'any' ? '' : styles[PRIORITY_CLASS[filters.priority]]
            }`}
            aria-label="Priority filter"
            value={filters.priority}
            onChange={(e) =>
              onFiltersChange({ ...filters, priority: e.target.value === 'any' ? 'any' : (Number(e.target.value) as Priority) })
            }
          >
            <option value="any">Any</option>
            {[...PRIORITIES].reverse().map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <ChevronDownIcon className={styles.chevron} />
        </label>
      </div>
      <div className={styles.tools} role="search">
        <div className={styles.search}>
          <SearchIcon className={styles.icon} />
          <input
            type="search"
            aria-label="Filter tasks by title"
            placeholder="Search"
            value={filters.query}
            onChange={(e) => onFiltersChange({ ...filters, query: e.target.value })}
          />
        </div>
        <button className={styles.switch} type="button" role="switch" aria-checked={byDay} onClick={() => onByDayChange(!byDay)}>
          <span className={styles.track} aria-hidden="true">
            <span className={styles.knob} />
          </span>
          By day
        </button>
      </div>
    </div>
  );
}
