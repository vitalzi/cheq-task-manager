import { applyFilters, groupByDay, type Filters } from '../filters';
import { useTasks } from '../useTasks';
import { TaskItem } from './TaskItem';
import styles from './TaskList.module.css';

interface Props {
  filters: Filters;
  onClearFilters: () => void;
}

export function TaskList({ filters, onClearFilters }: Props) {
  const { data, isPending, error, refetch, isFetching } = useTasks();

  if (isPending) {
    return (
      <div className={styles.skeleton} role="status" aria-label="Loading tasks" aria-busy="true">
        {[55, 40, 65].map((width) => (
          <div className={styles.skeletonRow} key={width}>
            <div className={styles.bar} style={{ width: `${width}%` }} />
            <div className={`${styles.bar} ${styles.barShort}`} />
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

  const groups = groupByDay(applyFilters(data, filters));
  if (groups.length === 0) {
    return (
      <div className={`${styles.empty} ${styles.noMatch}`}>
        <p>No tasks match your filter.</p>
        <button type="button" onClick={onClearFilters}>
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <div className={styles.groups}>
      {groups.map((group) => (
        <section className={styles.group} key={group.label}>
          <h2 className={styles.groupHeading}>{group.label}</h2>
          <ul className={styles.list}>
            {group.tasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
