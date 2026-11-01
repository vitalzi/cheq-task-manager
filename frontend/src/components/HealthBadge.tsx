import { useQuery } from '@tanstack/react-query';
import { getHealth } from '../api';
import styles from './HealthBadge.module.css';

export function HealthBadge() {
  // No retries: one failed poll should turn the badge red right away.
  const { isSuccess, isError } = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 5000,
    retry: false,
  });

  const state = isSuccess ? 'up' : isError ? 'down' : 'checking';
  return (
    <span className={`${styles.badge} ${styles[state]}`} role="status">
      API: {state}
    </span>
  );
}
