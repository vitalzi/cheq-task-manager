import type { Filters, Status } from '../filters';
import { SearchIcon } from './Icons';
import styles from './FilterBar.module.css';

const STATUSES: { value: Status; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'done', label: 'Done' },
];

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export function FilterBar({ filters, onChange }: Props) {
  return (
    <div className={styles.bar} role="search">
      <div className={styles.search}>
        <SearchIcon className={styles.icon} />
        <input
          type="search"
          aria-label="Filter tasks by title"
          placeholder="Filter by title"
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
        />
      </div>
      <div className={styles.segmented} role="group" aria-label="Status">
        {STATUSES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={filters.status === value}
            onClick={() => onChange({ ...filters, status: value })}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
