import { useQuery } from '@tanstack/react-query';
import { getTasks } from '../api';
import styles from './TaskList.module.css';

export function TaskList() {
  // No retries: a failed load should show the alert (with its own Retry button) at once.
  const { data, isPending, error, refetch, isFetching } = useQuery({
    queryKey: ['tasks'],
    queryFn: getTasks,
    retry: false,
  });

  if (isPending) return <p>Loading tasks…</p>;

  if (error) {
    return (
      <div className={styles.alert} role="alert">
        <p>Could not load tasks: {error.message}</p>
        <button onClick={() => refetch()} disabled={isFetching}>
          Retry
        </button>
      </div>
    );
  }

  if (data.length === 0) return <p>No tasks yet.</p>;

  return (
    <ul className={styles.list}>
      {data.map((task) => (
        <li key={task.id} className={styles.item}>
          <span>{task.title}</span>
          <time dateTime={task.createdAt}>{new Date(task.createdAt).toLocaleString()}</time>
        </li>
      ))}
    </ul>
  );
}
