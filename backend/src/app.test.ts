import { buildApp } from './app';
import { InMemoryTaskStore } from './tasks/store/inMemoryTaskStore';

describe('GET /health', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns 200 with status ok and the process uptime rounded down to whole seconds', async () => {
    jest.spyOn(process, 'uptime').mockReturnValue(12.7);
    const app = buildApp(new InMemoryTaskStore());

    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', uptime: 12 });
  });
});
