// Numbers, not names: they sort high first and, unlike a boolean, can be a DynamoDB index key.
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

// Async on purpose: a real database driver (e.g. DynamoDB) is async too.
export interface TaskStore {
  list(): Promise<Task[]>;
  create(task: Task): Promise<Task>;
}
