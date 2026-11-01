import { TaskService, ValidationError } from './taskService';
import type { Task, TaskStore } from './taskStore';

function mockStore(): jest.Mocked<TaskStore> {
  return {
    list: jest.fn().mockResolvedValue([]),
    create: jest.fn(async (task: Task) => task),
  };
}

describe('taskService', () => {
  let store: jest.Mocked<TaskStore>;
  let service: TaskService;

  beforeEach(() => {
    store = mockStore();
    service = new TaskService(store);
  });

  describe('create', () => {
    it('trims the title', async () => {
      const task = await service.create('  Write the README  ');

      expect(task.title).toBe('Write the README');
    });

    it('accepts a 200-character title surrounded by spaces', async () => {
      const title = 'a'.repeat(200);

      const task = await service.create(`   ${title}   `);

      expect(task.title).toBe(title);
    });

    it.each([
      ['a number', 42],
      ['null', null],
      ['undefined', undefined],
      ['an object', { a: 1 }],
    ])('rejects %s', async (_name, title) => {
      await expect(service.create(title)).rejects.toThrow(ValidationError);
      expect(store.create).not.toHaveBeenCalled();
    });

    it.each([
      ['an empty string', ''],
      ['a whitespace-only string', '   \t\n '],
    ])('rejects %s', async (_name, title) => {
      await expect(service.create(title)).rejects.toThrow(ValidationError);
      expect(store.create).not.toHaveBeenCalled();
    });

    it('rejects a title of 201 characters after trimming', async () => {
      await expect(service.create(` ${'a'.repeat(201)} `)).rejects.toThrow(ValidationError);
      expect(store.create).not.toHaveBeenCalled();
    });

    it('generates a UUID id and an ISO 8601 UTC createdAt', async () => {
      const task = await service.create('x');

      expect(task.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(new Date(task.createdAt).toISOString()).toBe(task.createdAt);
    });

    it('generates a different id for each task', async () => {
      const a = await service.create('x');
      const b = await service.create('x');

      expect(a.id).not.toBe(b.id);
    });

    it('calls the store once with the full task and returns its result', async () => {
      const stored: Task = { id: 'stored', title: 'from store', createdAt: '2026-11-02T09:30:00.000Z' };
      store.create.mockResolvedValue(stored);

      const result = await service.create('x');

      expect(store.create).toHaveBeenCalledTimes(1);
      expect(store.create).toHaveBeenCalledWith({
        id: expect.any(String),
        title: 'x',
        createdAt: expect.any(String),
      });
      expect(result).toBe(stored);
    });

    it('propagates store errors', async () => {
      store.create.mockRejectedValue(new Error('db down'));

      await expect(service.create('x')).rejects.toThrow('db down');
    });
  });

  describe('list', () => {
    it('returns what the store returns', async () => {
      const tasks: Task[] = [{ id: '1', title: 'a', createdAt: '2026-11-02T09:30:00.000Z' }];
      store.list.mockResolvedValue(tasks);

      expect(await service.list()).toBe(tasks);
    });

    it('propagates store errors', async () => {
      store.list.mockRejectedValue(new Error('db down'));

      await expect(service.list()).rejects.toThrow('db down');
    });
  });
});
