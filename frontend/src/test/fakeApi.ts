import { http, HttpResponse } from 'msw';
import type { Task } from '../api/api';
import { server } from './server';

export interface Write {
  method: string;
  path: string;
  body: unknown;
}

const url = (path: string) => `${import.meta.env.VITE_API_URL}${path}`;

// MSW handlers for the three calls the app makes. PATCH is kept in memory so the refetch
// after it returns the change. It does not copy the backend's rules (trimming, defaults, 404):
// those are tested in the backend, and these tests assert on the request the UI sent.
export class FakeApi {
  // Every POST and PATCH the app sent, for the tests to assert on.
  readonly writes: Write[] = [];
  private failure: number | null = null;
  private gate: Promise<void> | null = null;

  constructor(public tasks: Task[] = []) {}

  install(): void {
    server.use(
      http.get(url('/tasks'), () => HttpResponse.json(this.tasks)),
      http.post(url('/tasks'), async ({ request }) => {
        const body = (await request.clone().json()) as Partial<Task>;
        return (await this.beforeWrite(request, body)) ?? this.create(body);
      }),
      http.patch(url('/tasks/:id'), async ({ request, params }) => {
        const body = (await request.clone().json()) as Partial<Task>;
        return (await this.beforeWrite(request, body)) ?? this.update(String(params.id), body);
      }),
      http.delete(url('/tasks/:id'), async ({ request, params }) => {
        const early = await this.beforeWrite(request, undefined);
        if (early) return early;
        this.tasks = this.tasks.filter((task) => task.id !== params.id);
        return new HttpResponse(null, { status: 204 });
      }),
    );
  }

  // The next write answers with this status and { error }.
  failNextWrite(status = 500): void {
    this.failure = status;
  }

  // Writes wait until the returned function is called, to look at the pending state.
  holdWrites(): () => void {
    let release!: () => void;
    this.gate = new Promise((resolve) => (release = resolve));
    return () => {
      release();
      this.gate = null;
    };
  }

  // Records the write, then waits for a hold or answers with a queued failure.
  private async beforeWrite(request: Request, body: unknown): Promise<Response | undefined> {
    this.writes.push({ method: request.method, path: new URL(request.url).pathname, body });
    if (this.gate) await this.gate;
    if (this.failure) {
      const status = this.failure;
      this.failure = null;
      return HttpResponse.json({ error: 'Something went wrong' }, { status });
    }
  }

  private create(body: Partial<Task>): Response {
    return HttpResponse.json(sampleTask({ id: 'new', ...body }), { status: 201 });
  }

  private update(id: string, body: Partial<Task>): Response {
    this.tasks = this.tasks.map((task) => (task.id === id ? { ...task, ...body } : task));
    return HttpResponse.json(this.tasks.find((task) => task.id === id));
  }
}

export const sampleTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'id-0',
  title: 'Write the report',
  createdAt: '2026-11-02T09:30:00.000Z',
  done: 0,
  priority: 1,
  ...overrides,
});
