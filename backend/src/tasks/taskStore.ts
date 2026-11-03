// Numbers, not names: they sort high first. DynamoDB keys cannot be booleans, so numbers could
// become an index key if listing ever moves off Scan. At this size it has not, so there is no index.
export enum Priority {
  High = 0,
  Medium = 1,
  Low = 2,
}

export interface Task {
  id: string;
  title: string;
  createdAt: string;
  done: 0 | 1; // 0 open, 1 done
  priority: Priority;
}

// What an update may change. id and createdAt never change.
export type TaskChanges = Partial<Pick<Task, 'title' | 'done' | 'priority'>>;

// Async on purpose: a real database driver (e.g. DynamoDB) is async too.
export interface TaskStore {
  list(): Promise<Task[]>;
  create(task: Task): Promise<Task>;
  // The updated task, or undefined when there is no task with that id.
  update(id: string, changes: TaskChanges): Promise<Task | undefined>;
  // True when a task was deleted, false when there was none with that id.
  delete(id: string): Promise<boolean>;
}
