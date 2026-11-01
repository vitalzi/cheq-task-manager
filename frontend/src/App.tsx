import { HealthBadge } from './components/HealthBadge';
import { TaskList } from './components/TaskList';

export function App() {
  return (
    <main>
      <h1>Task Manager</h1>
      <HealthBadge />
      <TaskList />
    </main>
  );
}
