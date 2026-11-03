import { useQuery } from '@tanstack/react-query';
import { getHealth } from '../api';
import styles from './HealthBadge.module.css';

// 4320 seconds -> "1h 12m"; under an hour -> "5m".
export function formatUptime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function HealthBadge() {
  // No retries: one failed poll should turn the badge red right away.
  const { data, isError } = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 5000,
    retry: false,
  });

  // Error first: after a failed poll TanStack Query keeps the last good data
  const state = isError ? 'down' : data ? 'up' : 'checking';
  return (
    <span className={`${styles.badge} ${styles[state]}`} role="status">
      <span className={styles.dot} aria-hidden="true" />
      {state === 'checking' && 'Checking API…'}
      {state === 'down' && 'API down'}
      {state === 'up' && data && (
        <>
          <span>API up</span>
          <span> · uptime {formatUptime(data.uptime)}</span>
        </>
      )}
    </span>
  );
}
