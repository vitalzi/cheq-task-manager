import { useRef, useState } from 'react';
import { applyFilters, groupByDay, sortTasks, type Filters } from '../filters';
import { useTasks } from '../useTasks';
import { TaskItem, type RowMode } from './TaskItem';
import styles from './TaskList.module.css';

interface Props {
  filters: Filters;
  byDay: boolean;
  onClearFilters: () => void;
  onEmptied: () => void; // the last visible task was deleted
}

export function TaskList({ filters, byDay, onClearFilters, onEmptied }: Props) {
  const { data, isPending, error, refetch, isFetching } = useTasks();
  const list = useRef<HTMLDivElement>(null);
  // Only one row at a time is being edited or confirming a delete.
  const [active, setActive] = useState<{ id: string; mode: Exclude<RowMode, 'view'> } | null>(null);

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
    if (filters.query.trim() !== '' || filters.priority !== 'any') {
      return (
        <div className={`${styles.empty} ${styles.noMatch}`}>
          <p>No tasks match your filters.</p>
          <button type="button" onClick={onClearFilters}>
            Clear filters
          </button>
        </div>
      );
    }
    return (
      <p className={styles.empty}>{filters.status === 'open' ? 'Nothing open. Everything is done.' : 'Nothing done yet.'}</p>
    );
  }

  const groups = byDay ? groupByDay(shown) : [{ label: null, tasks: sortTasks(shown) }];

  // Focus the row after the deleted one, else the one before it, else the composer. Done before the
  // refetch removes the row, so focus never falls back to the page.
  function focusAfterDelete(id: string) {
    const ids = groups.flatMap((group) => group.tasks.map((task) => task.id));
    const neighbour = ids[ids.indexOf(id) + 1] ?? ids[ids.indexOf(id) - 1];
    if (neighbour === undefined) return onEmptied();
    list.current?.querySelector<HTMLInputElement>(`[data-task-id="${neighbour}"] input[type="checkbox"]`)?.focus();
  }

  const row = (task: (typeof shown)[number]) => (
    <TaskItem
      key={task.id}
      task={task}
      byDay={byDay}
      mode={active?.id === task.id ? active.mode : 'view'}
      onModeChange={(mode) =>
        setActive((current) => (mode !== 'view' ? { id: task.id, mode } : current?.id === task.id ? null : current))
      }
      onDeleted={() => focusAfterDelete(task.id)}
    />
  );

  return (
    <div className={styles.groups} ref={list}>
      {groups.map((group) =>
        group.label === null ? (
          <ul className={styles.card} key="all">
            {group.tasks.map(row)}
          </ul>
        ) : (
          <section className={styles.group} key={group.label}>
            <h2 className={styles.groupHeading}>{group.label}</h2>
            <ul className={styles.card}>{group.tasks.map(row)}</ul>
          </section>
        ),
      )}
    </div>
  );
}
