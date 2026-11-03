import { statusCounts, type Filters, type Status } from '../filters';
import { useTasks } from '../useTasks';
import { SearchIcon } from './Icons';
import styles from './Toolbar.module.css';

const TABS: { value: Status; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'done', label: 'Done' },
  { value: 'all', label: 'All' },
];

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
      <nav className={styles.tabs} aria-label="Status">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={filters.status === value}
            onClick={() => onFiltersChange({ ...filters, status: value })}
          >
            {label}
            {counts && (
              <>
                {' '}
                <span className={styles.count}>{counts[value]}</span>
              </>
            )}
          </button>
        ))}
      </nav>
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
