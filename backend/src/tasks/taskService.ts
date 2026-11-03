import { randomUUID } from 'node:crypto';
import type { Priority, Task, TaskStore } from './taskStore';

// Already validated by the route schema; the service only adds what the server owns.
export interface NewTask {
  title: string;
  priority: Priority;
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
}
