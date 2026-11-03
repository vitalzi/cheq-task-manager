import { useRef, useState } from 'react';
import { DEFAULT_FILTERS, type Filters } from './lib/filters';
import { HealthBadge } from './components/HealthBadge/HealthBadge';
import { TaskForm } from './components/TaskForm/TaskForm';
import { TaskList } from './components/TaskList/TaskList';
import { Toolbar } from './components/Toolbar/Toolbar';
import styles from './App.module.css';

export function App() {
  // The dropdowns, the search and the list all read the same filters.
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [byDay, setByDay] = useState(true);
  const composer = useRef<HTMLInputElement>(null);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Tasks</h1>
        <HealthBadge />
      </header>
      <TaskForm inputRef={composer} />
      <Toolbar filters={filters} onFiltersChange={setFilters} byDay={byDay} onByDayChange={setByDay} />
      <TaskList
        filters={filters}
        byDay={byDay}
        onClearFilters={() => setFilters({ ...filters, query: '', priority: 'any' })}
        onEmptied={() => composer.current?.focus()}
      />
    </main>
  );
}
