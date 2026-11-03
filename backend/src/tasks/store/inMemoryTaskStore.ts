import type { Task, TaskChanges, TaskStore } from './taskStore';

export class InMemoryTaskStore implements TaskStore {
  private readonly tasks: Task[] = [];

  async list(): Promise<Task[]> {
    return [...this.tasks];
  }

  async create(task: Task): Promise<Task> {
    this.tasks.push(task);
    return task;
  }

  async update(id: string, changes: TaskChanges): Promise<Task | undefined> {
    const index = this.tasks.findIndex((t) => t.id === id);
    if (index === -1) return undefined;
    // Replace, don't edit: tasks already handed out by list() must not change under the caller.
    const updated = { ...this.tasks[index], ...changes };
    this.tasks[index] = updated;
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const index = this.tasks.findIndex((t) => t.id === id);
    if (index === -1) return false;
    this.tasks.splice(index, 1);
    return true;
  }
}
