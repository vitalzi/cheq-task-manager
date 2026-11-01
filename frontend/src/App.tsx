import { HealthBadge } from './components/HealthBadge';
import { TaskForm } from './components/TaskForm';
import { TaskList } from './components/TaskList';
import styles from './App.module.css';

export function App() {
  return (
    <main className={styles.page}>
      <h1>Task Manager</h1>
      <HealthBadge />
      <TaskForm />
      <TaskList />
    </main>
  );
}
