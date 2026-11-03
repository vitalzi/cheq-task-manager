import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import { InMemoryTaskStore } from './store/inMemoryTaskStore';
import type { Task, TaskStore } from './store/taskStore';

const json = { 'content-type': 'application/json' };

describe('task routes', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = buildApp(new InMemoryTaskStore());
  });

  const post = (payload: string | object | undefined, headers: Record<string, string> = json) =>
    app.inject({ method: 'POST', url: '/tasks', headers, payload });

  const patch = (id: string, payload: string | object | undefined, headers: Record<string, string> = json) =>
    app.inject({ method: 'PATCH', url: `/tasks/${id}`, headers, payload });

  const remove = (id: string) => app.inject({ method: 'DELETE', url: `/tasks/${id}` });

  const list = async (): Promise<Task[]> => (await app.inject({ method: 'GET', url: '/tasks' })).json();

  const expectErrorShape = (res: { json: () => unknown }) => {
    const body = res.json() as { error: unknown };
    expect(Object.keys(body)).toEqual(['error']);
    expect(typeof body.error).toBe('string');
    expect(body.error).not.toBe('');
  };

  describe('GET /tasks', () => {
    it('returns 200 and an empty array when there are no tasks', async () => {
      const res = await app.inject({ method: 'GET', url: '/tasks' });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });
  });

  describe('POST /tasks', () => {
    it('returns 201 and the created task', async () => {
      const res = await post({ title: 'Write the README' });

      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual({
        id: expect.any(String),
        title: 'Write the README',
        createdAt: expect.any(String),
        done: 0,
        priority: 1,
      });
    });

    it.each([0, 1, 2])('keeps an explicit priority of %i', async (priority) => {
      const res = await post({ title: 'x', priority });

      expect(res.statusCode).toBe(201);
      expect(res.json().priority).toBe(priority);
    });

    it.each([
      ['3', 3],
      ['-1', -1],
      ['1.5', 1.5],
      ['"1"', '1'],
      ['null', null],
      ['true', true],
    ])('returns 400 for priority %s', async (_name, priority) => {
      const res = await post({ title: 'x', priority });

      expect(res.statusCode).toBe(400);
      expectErrorShape(res);
      expect((await app.inject({ method: 'GET', url: '/tasks' })).json()).toEqual([]);
    });

    it('trims the title', async () => {
      const res = await post({ title: '  padded  ' });

      expect(res.json().title).toBe('padded');
    });

    it('accepts 200 characters plus surrounding spaces', async () => {
      const title = 'a'.repeat(200);

      const res = await post({ title: `  ${title}  ` });

      expect(res.statusCode).toBe(201);
      expect(res.json().title).toBe(title);
    });

    it('ignores unknown fields', async () => {
      const res = await post({ title: 'x', id: 'mine', done: true });

      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual({
        id: expect.not.stringMatching(/^mine$/),
        title: 'x',
        createdAt: expect.any(String),
        done: 0,
        priority: 1,
      });
    });

    it('lists the task after it is created, oldest first', async () => {
      const first: Task = (await post({ title: 'first' })).json();
      const second: Task = (await post({ title: 'second' })).json();

      const res = await app.inject({ method: 'GET', url: '/tasks' });

      expect(res.json()).toEqual([first, second]);
    });

    it.each([
      ['a missing title', {}],
      ['an empty title', { title: '' }],
      ['a whitespace-only title', { title: '   ' }],
      ['a number title', { title: 42 }],
      ['a boolean title', { title: true }],
      ['an array title', { title: ['a'] }],
      ['an object title', { title: { a: 1 } }],
      ['a null title', { title: null }],
      ['a title of 201 characters after trimming', { title: ` ${'a'.repeat(201)} ` }],
    ])('returns 400 for %s', async (_name, payload) => {
      const res = await post(payload);

      expect(res.statusCode).toBe(400);
      expectErrorShape(res);
      expect((await app.inject({ method: 'GET', url: '/tasks' })).json()).toEqual([]);
    });

    it.each([
      ['malformed JSON', '{"title": '],
      ['an empty body', ''],
      ['a null body', 'null'],
      ['an array body', '[]'],
      ['a string body', '"just a string"'],
      ['a number body', '42'],
    ])('returns 400 for %s', async (_name, payload) => {
      const res = await post(payload);

      expect(res.statusCode).toBe(400);
      expectErrorShape(res);
    });

    it('returns 400 when there is no body and no content type', async () => {
      const res = await post(undefined, {});

      expect(res.statusCode).toBe(400);
      expectErrorShape(res);
    });

    it('returns 400 for a text/plain body (Fastify parses it as a string, which is not an object)', async () => {
      const res = await post('title=x', { 'content-type': 'text/plain' });

      expect(res.statusCode).toBe(400);
      expectErrorShape(res);
    });

    it('returns 415 for a content type Fastify has no parser for', async () => {
      const res = await post('<title>x</title>', { 'content-type': 'application/xml' });

      expect(res.statusCode).toBe(415);
      expectErrorShape(res);
    });
  });

  describe('PATCH /tasks/:id', () => {
    let created: Task;

    beforeEach(async () => {
      created = (await post({ title: 'original', priority: 0 })).json();
    });

    it('returns 200 and the updated task, changing only the given field', async () => {
      const res = await patch(created.id, { done: 1 });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ ...created, done: 1 });
      expect(await list()).toEqual([{ ...created, done: 1 }]);
    });

    it('keeps the priority when the body does not mention it (no default is applied)', async () => {
      const res = await patch(created.id, { title: 'renamed' });

      expect(res.json().priority).toBe(0);
    });

    it('changes the priority', async () => {
      const res = await patch(created.id, { priority: 2 });

      expect(res.json()).toEqual({ ...created, priority: 2 });
    });

    it('changes several fields at once', async () => {
      const res = await patch(created.id, { title: 'new', done: 1, priority: 2 });

      expect(res.json()).toEqual({ ...created, title: 'new', done: 1, priority: 2 });
    });

    it('trims the title and accepts 200 characters plus surrounding spaces', async () => {
      const title = 'a'.repeat(200);

      const res = await patch(created.id, { title: `  ${title}  ` });

      expect(res.statusCode).toBe(200);
      expect(res.json().title).toBe(title);
    });

    it('never changes id or createdAt, and ignores other unknown fields', async () => {
      const res = await patch(created.id, { done: 1, id: 'other', createdAt: 'yesterday', extra: true });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ ...created, done: 1 });
      expect(await list()).toEqual([{ ...created, done: 1 }]);
    });

    it('returns 404 for an unknown id and creates nothing', async () => {
      const res = await patch('missing', { done: 1 });

      expect(res.statusCode).toBe(404);
      expectErrorShape(res);
      expect(await list()).toEqual([created]);
    });

    it.each([
      ['an empty title', { title: '' }],
      ['a whitespace-only title', { title: '   ' }],
      ['a number title', { title: 42 }],
      ['a null title', { title: null }],
      ['a title of 201 characters after trimming', { title: ` ${'a'.repeat(201)} ` }],
      ['a done of 2', { done: 2 }],
      ['a done of -1', { done: -1 }],
      ['a done of true', { done: true }],
      ['a done of "1"', { done: '1' }],
      ['a null done', { done: null }],
      ['a priority of 3', { priority: 3 }],
      ['a priority of 1.5', { priority: 1.5 }],
      ['a priority of "1"', { priority: '1' }],
      ['a null priority', { priority: null }],
      ['an empty object', {}],
      ['only unknown fields', { extra: 1 }],
      ['only id and createdAt', { id: 'other', createdAt: 'yesterday' }],
    ])('returns 400 for %s and changes nothing', async (_name, payload) => {
      const res = await patch(created.id, payload);

      expect(res.statusCode).toBe(400);
      expectErrorShape(res);
      expect(await list()).toEqual([created]);
    });

    it.each([
      ['an empty object', {}],
      ['only unknown fields', { extra: 1, id: 'other' }],
    ])('says which fields to send for %s', async (_name, payload) => {
      const res = await patch(created.id, payload);

      expect(res.json()).toEqual({ error: 'body must include at least one of title, done, priority' });
    });

    it('keeps the plain message for a bad value', async () => {
      const res = await patch(created.id, { done: 2 });

      expect(res.json()).toEqual({ error: 'body/done must be equal to one of the allowed values' });
    });

    it.each([
      ['malformed JSON', '{"done": '],
      ['an empty body', ''],
      ['a null body', 'null'],
      ['an array body', '[]'],
      ['a string body', '"just a string"'],
    ])('returns 400 for %s', async (_name, payload) => {
      const res = await patch(created.id, payload);

      expect(res.statusCode).toBe(400);
      expectErrorShape(res);
    });

    it('returns 400 for a text/plain body', async () => {
      const res = await patch(created.id, 'done=1', { 'content-type': 'text/plain' });

      expect(res.statusCode).toBe(400);
      expectErrorShape(res);
    });

    it('returns 415 for a content type Fastify has no parser for', async () => {
      const res = await patch(created.id, '<done>1</done>', { 'content-type': 'application/xml' });

      expect(res.statusCode).toBe(415);
      expectErrorShape(res);
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('returns 204 with no body and removes only that task', async () => {
      const a: Task = (await post({ title: 'a' })).json();
      const b: Task = (await post({ title: 'b' })).json();

      const res = await remove(a.id);

      expect(res.statusCode).toBe(204);
      expect(res.body).toBe('');
      expect(await list()).toEqual([b]);
    });

    it('returns 404 for an unknown id', async () => {
      const res = await remove('missing');

      expect(res.statusCode).toBe(404);
      expectErrorShape(res);
    });

    it('returns 404 the second time', async () => {
      const a: Task = (await post({ title: 'a' })).json();
      await remove(a.id);

      expect((await remove(a.id)).statusCode).toBe(404);
    });
  });

  describe('unknown routes and methods', () => {
    it('returns 404 in the error shape for an unknown route', async () => {
      const res = await app.inject({ method: 'GET', url: '/nope' });

      expect(res.statusCode).toBe(404);
      expectErrorShape(res);
    });

    it('returns 404 in the error shape for an unsupported method on a known route', async () => {
      const res = await app.inject({ method: 'DELETE', url: '/tasks' });

      expect(res.statusCode).toBe(404);
      expectErrorShape(res);
    });
  });

  describe('store failures', () => {
    it('returns 500 with a generic message and does not leak the cause', async () => {
      const failing: TaskStore = {
        list: async () => {
          throw new Error('secret connection string');
        },
        create: async () => {
          throw new Error('secret connection string');
        },
        update: async () => {
          throw new Error('secret connection string');
        },
        delete: async () => {
          throw new Error('secret connection string');
        },
      };
      const failingApp = buildApp(failing);

      const listed = await failingApp.inject({ method: 'GET', url: '/tasks' });
      const create = await failingApp.inject({
        method: 'POST',
        url: '/tasks',
        headers: json,
        payload: { title: 'x' },
      });

      const update = await failingApp.inject({
        method: 'PATCH',
        url: '/tasks/id-1',
        headers: json,
        payload: { done: 1 },
      });
      const del = await failingApp.inject({ method: 'DELETE', url: '/tasks/id-1' });

      for (const res of [listed, create, update, del]) {
        expect(res.statusCode).toBe(500);
        expectErrorShape(res);
        expect(res.body).not.toContain('secret');
      }
    });
  });
});
