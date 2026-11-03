// Plain numbers on the wire, same as the API: 0 high, 1 medium, 2 low.
export type Priority = 0 | 1 | 2;

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 0, label: 'High' },
  { value: 1, label: 'Medium' },
  { value: 2, label: 'Low' },
];

export interface Task {
  id: string;
  title: string;
  createdAt: string;
  done: 0 | 1; // 0 open, 1 done
  priority: Priority;
}

export type TaskChanges = Partial<Pick<Task, 'title' | 'done' | 'priority'>>;

export interface Health {
  status: string;
  uptime: number;
}

// Empty in local dev (Vite proxy); the ALB URL in the deployed build.
const baseUrl = import.meta.env.VITE_API_URL ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, init);
  if (!res.ok) {
    // Errors from the API are { error }; a proxy or ALB may answer with HTML.
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export const getHealth = () => request<Health>('/health');

export const getTasks = () => request<Task[]>('/tasks');

const jsonRequest = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const createTask = (input: { title: string; priority: Priority }) =>
  request<Task>('/tasks', jsonRequest('POST', input));

export const updateTask = ({ id, changes }: { id: string; changes: TaskChanges }) =>
  request<Task>(`/tasks/${id}`, jsonRequest('PATCH', changes));
