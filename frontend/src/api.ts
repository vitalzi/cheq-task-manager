export interface Task {
  id: string;
  title: string;
  createdAt: string;
}

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

export const createTask = (title: string) =>
  request<Task>('/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
