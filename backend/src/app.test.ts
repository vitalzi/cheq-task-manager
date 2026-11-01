import { buildApp } from './app';
import { InMemoryTaskStore } from './tasks/inMemoryTaskStore';

describe('GET /health', () => {
  it('returns 200 with status ok and uptime in whole seconds', async () => {
    const app = buildApp(new InMemoryTaskStore());

    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(Number.isInteger(body.uptime)).toBe(true);
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });
});
