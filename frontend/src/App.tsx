import { useState } from 'react';
import { DEFAULT_FILTERS, type Filters } from './filters';
import { HealthBadge } from './components/HealthBadge';
import { TaskForm } from './components/TaskForm';
import { TaskList } from './components/TaskList';
import { Toolbar } from './components/Toolbar';
import styles from './App.module.css';

export function App() {
  // The tabs, the search and the list all read the same filters.
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [byDay, setByDay] = useState(true);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Tasks</h1>
        <HealthBadge />
      </header>
      <TaskForm />
      <Toolbar filters={filters} onFiltersChange={setFilters} byDay={byDay} onByDayChange={setByDay} />
      <TaskList filters={filters} byDay={byDay} onClearSearch={() => setFilters({ ...filters, query: '' })} />
    </main>
  );
}
