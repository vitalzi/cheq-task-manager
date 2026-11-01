import { HealthBadge } from './components/HealthBadge';
import { TaskForm } from './components/TaskForm';
import { TaskList } from './components/TaskList';

export function App() {
  return (
    <main>
      <h1>Task Manager</h1>
      <HealthBadge />
      <TaskForm />
      <TaskList />
    </main>
  );
}
