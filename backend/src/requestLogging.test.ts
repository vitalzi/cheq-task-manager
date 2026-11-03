import { Writable } from 'node:stream';
import { buildApp } from './app';
import { InMemoryTaskStore } from './tasks/store/inMemoryTaskStore';

function appWithCapturedLogs() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, done) {
      lines.push(chunk.toString());
      done();
    },
  });
  const app = buildApp(new InMemoryTaskStore(), { logger: { level: 'info', stream } });
  return { app, entries: () => lines.map((line) => JSON.parse(line)) };
}

describe('request logging', () => {
  it('logs exactly one line per request with method, path, status and response time', async () => {
    const { app, entries } = appWithCapturedLogs();

    await app.inject({ method: 'GET', url: '/tasks' });

    expect(entries()).toHaveLength(1);
    expect(entries()[0]).toMatchObject({
      method: 'GET',
      path: '/tasks',
      status: 200,
      responseTimeMs: expect.any(Number),
    });
    expect(entries()[0].responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('logs the path without the query string', async () => {
    const { app, entries } = appWithCapturedLogs();

    await app.inject({ method: 'GET', url: '/tasks?token=secret' });

    expect(entries()[0].path).toBe('/tasks');
    expect(JSON.stringify(entries())).not.toContain('secret');
  });

  it.each([
    ['a created task', 'POST', '/tasks', { title: 'x' }, 201],
    ['a rejected task', 'POST', '/tasks', { title: '' }, 400],
    ['an unknown route', 'GET', '/nope', undefined, 404],
  ] as const)('logs the status of %s', async (_name, method, url, payload, status) => {
    const { app, entries } = appWithCapturedLogs();

    await app.inject({ method, url, payload });

    expect(entries()).toHaveLength(1);
    expect(entries()[0]).toMatchObject({ method, path: url, status });
  });
});
