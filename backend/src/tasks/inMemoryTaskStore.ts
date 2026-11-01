import type { Task, TaskStore } from './taskStore';

export class InMemoryTaskStore implements TaskStore {
  private readonly tasks: Task[] = [];

  async list(): Promise<Task[]> {
    return [...this.tasks];
  }

  async create(task: Task): Promise<Task> {
    this.tasks.push(task);
    return task;
  }
}
