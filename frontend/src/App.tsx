import { useState } from 'react';
import { NO_FILTERS, type Filters } from './filters';
import { CountHeading } from './components/CountHeading';
import { FilterBar } from './components/FilterBar';
import { HealthBadge } from './components/HealthBadge';
import { TaskForm } from './components/TaskForm';
import { TaskList } from './components/TaskList';
import styles from './App.module.css';

export function App() {
  // The heading, the filter bar and the list all read the same filters.
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <span className={styles.brand}>Task manager</span>
        <HealthBadge />
      </header>
      <CountHeading filters={filters} />
      <TaskForm />
      <FilterBar filters={filters} onChange={setFilters} />
      <TaskList filters={filters} onClearFilters={() => setFilters(NO_FILTERS)} />
    </main>
  );
}
