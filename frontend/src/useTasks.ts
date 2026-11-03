import { useQuery } from '@tanstack/react-query';
import { getTasks } from './api';

// No retries: a failed load should show the error card (with its own Retry button) at once.
// Components share one cache entry, so the heading and the list never fetch twice.
export const useTasks = () => useQuery({ queryKey: ['tasks'], queryFn: getTasks, retry: false });
