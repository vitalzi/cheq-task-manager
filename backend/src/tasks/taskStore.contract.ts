import { Priority } from './taskStore';
import type { Task, TaskStore } from './taskStore';

// Shared behaviour every TaskStore implementation must satisfy.
// Not a *.test.ts file: each implementation's own test file calls it.
// createStore may be async: a database-backed store needs a fresh table per test.
export function describeTaskStore(createStore: () => TaskStore | Promise<TaskStore>): void {
  const task = (n: number): Task => ({
    id: `id-${n}`,
    title: `Task ${n}`,
    createdAt: `2026-11-02T09:30:${String(n).padStart(2, '0')}Z`,
    done: 0,
    priority: Priority.Medium,
  });

  describe('TaskStore contract', () => {
    let store: TaskStore;

    beforeEach(async () => {
      store = await createStore();
    });

    it('lists no tasks when empty', async () => {
      expect(await store.list()).toEqual([]);
    });

    it('returns the created task and lists it', async () => {
      const created = await store.create(task(1));

      expect(created).toEqual(task(1));
      expect(await store.list()).toEqual([task(1)]);
    });

    it('stores done and priority as given', async () => {
      const created = { ...task(1), done: 1 as const, priority: Priority.Low };

      await store.create(created);

      expect(await store.list()).toEqual([created]);
    });

    it('lists tasks in creation order, oldest first', async () => {
      // Ten tasks: a store that does not sort (DynamoDB scans in hash order) would
      // pass three by chance one time in six, and ten almost never.
      const tasks = Array.from({ length: 10 }, (_, i) => task(i + 1));
      for (const t of tasks) await store.create(t);

      expect(await store.list()).toEqual(tasks);
    });

    it('is not affected by changes to the array returned by list()', async () => {
      await store.create(task(1));

      const listed = await store.list();
      listed.push(task(2));
      listed.length = 0;

      expect(await store.list()).toEqual([task(1)]);
    });
  });
}
