import { NotFoundError, TaskService } from './taskService';
import { Priority } from './taskStore';
import type { Task, TaskStore } from './taskStore';

function mockStore(): jest.Mocked<TaskStore> {
  return {
    list: jest.fn().mockResolvedValue([]),
    create: jest.fn(async (task: Task) => task),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

const input = { title: 'x', priority: Priority.Medium };

describe('taskService', () => {
  let store: jest.Mocked<TaskStore>;
  let service: TaskService;

  beforeEach(() => {
    store = mockStore();
    service = new TaskService(store);
  });

  describe('create', () => {
    it('keeps the title and priority it is given', async () => {
      const task = await service.create({ title: 'Write the README', priority: Priority.Low });

      expect(task.title).toBe('Write the README');
      expect(task.priority).toBe(Priority.Low);
    });

    it('starts the task open', async () => {
      const task = await service.create(input);

      expect(task.done).toBe(0);
    });

    it('generates a UUID id and an ISO 8601 UTC createdAt', async () => {
      const task = await service.create(input);

      expect(task.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(new Date(task.createdAt).toISOString()).toBe(task.createdAt);
    });

    it('generates a different id for each task', async () => {
      const a = await service.create(input);
      const b = await service.create(input);

      expect(a.id).not.toBe(b.id);
    });

    it('calls the store once with the full task and returns its result', async () => {
      const stored: Task = {
        id: 'stored',
        title: 'from store',
        createdAt: '2026-11-02T09:30:00.000Z',
        done: 0,
        priority: Priority.Medium,
      };
      store.create.mockResolvedValue(stored);

      const result = await service.create(input);

      expect(store.create).toHaveBeenCalledTimes(1);
      expect(store.create).toHaveBeenCalledWith({
        id: expect.any(String),
        title: 'x',
        createdAt: expect.any(String),
        done: 0,
        priority: Priority.Medium,
      });
      expect(result).toBe(stored);
    });

    it('propagates store errors', async () => {
      store.create.mockRejectedValue(new Error('db down'));

      await expect(service.create(input)).rejects.toThrow('db down');
    });
  });

  describe('update', () => {
    const stored: Task = {
      id: 'id-1',
      title: 'Renamed',
      createdAt: '2026-11-02T09:30:00.000Z',
      done: 1,
      priority: Priority.High,
    };

    it('passes the id and the changes to the store and returns the updated task', async () => {
      store.update.mockResolvedValue(stored);

      const result = await service.update('id-1', { done: 1 });

      expect(store.update).toHaveBeenCalledWith('id-1', { done: 1 });
      expect(result).toBe(stored);
    });

    it('throws NotFoundError when the store has no such task', async () => {
      store.update.mockResolvedValue(undefined);

      await expect(service.update('missing', { done: 1 })).rejects.toThrow(NotFoundError);
    });

    it('propagates store errors', async () => {
      store.update.mockRejectedValue(new Error('db down'));

      await expect(service.update('id-1', { done: 1 })).rejects.toThrow('db down');
    });
  });

  describe('delete', () => {
    it('deletes through the store', async () => {
      store.delete.mockResolvedValue(true);

      await expect(service.delete('id-1')).resolves.toBeUndefined();
      expect(store.delete).toHaveBeenCalledWith('id-1');
    });

    it('throws NotFoundError when the store has no such task', async () => {
      store.delete.mockResolvedValue(false);

      await expect(service.delete('missing')).rejects.toThrow(NotFoundError);
    });

    it('propagates store errors', async () => {
      store.delete.mockRejectedValue(new Error('db down'));

      await expect(service.delete('id-1')).rejects.toThrow('db down');
    });
  });

  describe('list', () => {
    it('returns what the store returns', async () => {
      const tasks: Task[] = [
        { id: '1', title: 'a', createdAt: '2026-11-02T09:30:00.000Z', done: 0, priority: Priority.Medium },
      ];
      store.list.mockResolvedValue(tasks);

      expect(await service.list()).toBe(tasks);
    });

    it('propagates store errors', async () => {
      store.list.mockRejectedValue(new Error('db down'));

      await expect(service.list()).rejects.toThrow('db down');
    });
  });
});
