import { applyFilters, headingFor, type Filters } from '../filters';
import { useTasks } from '../useTasks';
import styles from './CountHeading.module.css';

export function CountHeading({ filters }: { filters: Filters }) {
  const { data } = useTasks();
  // Until the tasks have loaded (or if they fail) there is no count to show.
  const text = data ? headingFor(data, applyFilters(data, filters).length, filters) : 'Tasks';
  return <h1 className={styles.heading}>{text}</h1>;
}
