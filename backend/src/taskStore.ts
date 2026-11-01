export interface Task {
  id: string;
  title: string;
  createdAt: string;
}

// Async on purpose: a real database driver (e.g. DynamoDB) is async too.
export interface TaskStore {
  list(): Promise<Task[]>;
  create(task: Task): Promise<Task>;
}
