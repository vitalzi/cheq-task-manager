import { buildApp } from './app';
import { InMemoryTaskStore } from './inMemoryTaskStore';

const allowed = 'http://my-bucket.s3-website.eu-west-1.amazonaws.com';

describe('CORS', () => {
  const appWith = (corsOrigin?: string) => buildApp(new InMemoryTaskStore(), { corsOrigin });

  it('allows the configured origin', async () => {
    const res = await appWith(allowed).inject({
      method: 'GET',
      url: '/tasks',
      headers: { origin: allowed },
    });

    expect(res.headers['access-control-allow-origin']).toBe(allowed);
  });

  it('does not allow any other origin', async () => {
    const res = await appWith(allowed).inject({
      method: 'GET',
      url: '/tasks',
      headers: { origin: 'http://evil.example' },
    });

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers the preflight for a JSON POST', async () => {
    const res = await appWith(allowed).inject({
      method: 'OPTIONS',
      url: '/tasks',
      headers: {
        origin: allowed,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });

    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(allowed);
    expect(res.headers['access-control-allow-methods']).toContain('POST');
    expect(res.headers['access-control-allow-headers']).toMatch(/content-type/i);
  });

  it('sends no CORS headers when no origin is configured', async () => {
    const res = await appWith(undefined).inject({
      method: 'GET',
      url: '/tasks',
      headers: { origin: allowed },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
