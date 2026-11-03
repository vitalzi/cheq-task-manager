import { applyFilters, groupByDay, sortTasks, type Filters } from '../filters';
import { useTasks } from '../useTasks';
import { TaskItem } from './TaskItem';
import styles from './TaskList.module.css';

interface Props {
  filters: Filters;
  byDay: boolean;
  onClearSearch: () => void;
}

export function TaskList({ filters, byDay, onClearSearch }: Props) {
  const { data, isPending, error, refetch, isFetching } = useTasks();

  if (isPending) {
    return (
      <div className={styles.card} role="status" aria-label="Loading tasks" aria-busy="true">
        {[50, 38, 62].map((width) => (
          <div className={styles.skeletonRow} key={width}>
            <div className={styles.skeletonBox} />
            <div className={styles.skeletonText}>
              <div className={styles.bar} style={{ width: `${width}%` }} />
              <div className={`${styles.bar} ${styles.barShort}`} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.alert} role="alert">
        <div className={styles.alertText}>
          <strong>Couldn’t load tasks</strong>
          <span>{error.message}</span>
        </div>
        <button onClick={() => refetch()} disabled={isFetching}>
          Retry
        </button>
      </div>
    );
  }

  if (data.length === 0) return <p className={styles.empty}>No tasks yet — add your first one above.</p>;

  const shown = applyFilters(data, filters);
  if (shown.length === 0) {
    if (filters.query.trim() !== '') {
      return (
        <div className={`${styles.empty} ${styles.noMatch}`}>
          <p>No tasks match your filter.</p>
          <button type="button" onClick={onClearSearch}>
            Clear search
          </button>
        </div>
      );
    }
    return (
      <p className={styles.empty}>{filters.status === 'open' ? 'Nothing open. Everything is done.' : 'Nothing done yet.'}</p>
    );
  }

  if (!byDay) {
    return (
      <ul className={styles.card}>
        {sortTasks(shown).map((task) => (
          <TaskItem key={task.id} task={task} byDay={false} />
        ))}
      </ul>
    );
  }

  return (
    <div className={styles.groups}>
      {groupByDay(shown).map((group) => (
        <section className={styles.group} key={group.label}>
          <h2 className={styles.groupHeading}>{group.label}</h2>
          <ul className={styles.card}>
            {group.tasks.map((task) => (
              <TaskItem key={task.id} task={task} byDay />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
