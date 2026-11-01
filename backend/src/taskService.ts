import { randomUUID } from 'node:crypto';
import type { Task, TaskStore } from './taskStore';

const MAX_TITLE_LENGTH = 200;

// Mapped to HTTP 400 by the error handler; any other error becomes 500.
export class ValidationError extends Error {}

export class TaskService {
  constructor(private readonly store: TaskStore) {}

  list(): Promise<Task[]> {
    return this.store.list();
  }

  async create(title: unknown): Promise<Task> {
    if (typeof title !== 'string') {
      throw new ValidationError('title must be a string');
    }
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      throw new ValidationError('title must not be empty');
    }
    if (trimmed.length > MAX_TITLE_LENGTH) {
      throw new ValidationError(`title must be at most ${MAX_TITLE_LENGTH} characters`);
    }

    return this.store.create({
      id: randomUUID(),
      title: trimmed,
      createdAt: new Date().toISOString(),
    });
  }
}
