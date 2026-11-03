import { randomUUID } from 'node:crypto';
import type { Priority, Task, TaskChanges, TaskStore } from './store/taskStore';

// Already validated by the route schema; the service only adds what the server owns.
export interface NewTask {
  title: string;
  priority: Priority;
}

// statusCode makes the error handler in app.ts answer 404 with { error }.
export class NotFoundError extends Error {
  readonly statusCode = 404;
}

export class TaskService {
  constructor(private readonly store: TaskStore) {}

  list(): Promise<Task[]> {
    return this.store.list();
  }

  create(input: NewTask): Promise<Task> {
    return this.store.create({
      id: randomUUID(),
      title: input.title,
      createdAt: new Date().toISOString(),
      done: 0,
      priority: input.priority,
    });
  }

  // changes are already validated by the route schema and hold only title, done and priority.
  async update(id: string, changes: TaskChanges): Promise<Task> {
    const task = await this.store.update(id, changes);
    if (!task) throw new NotFoundError('Task not found');
    return task;
  }

  async delete(id: string): Promise<void> {
    if (!(await this.store.delete(id))) throw new NotFoundError('Task not found');
  }
}
