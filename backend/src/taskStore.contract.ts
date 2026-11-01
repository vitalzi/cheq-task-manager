import type { Task, TaskStore } from './taskStore';

// Shared behaviour every TaskStore implementation must satisfy.
// Not a *.test.ts file: each implementation's own test file calls it.
export function describeTaskStore(createStore: () => TaskStore): void {
  const task = (n: number): Task => ({
    id: `id-${n}`,
    title: `Task ${n}`,
    createdAt: `2026-11-02T09:30:0${n}Z`,
  });

  describe('TaskStore contract', () => {
    let store: TaskStore;

    beforeEach(() => {
      store = createStore();
    });

    it('lists no tasks when empty', async () => {
      expect(await store.list()).toEqual([]);
    });

    it('returns the created task and lists it', async () => {
      const created = await store.create(task(1));

      expect(created).toEqual(task(1));
      expect(await store.list()).toEqual([task(1)]);
    });

    it('lists tasks in creation order, oldest first', async () => {
      await store.create(task(1));
      await store.create(task(2));
      await store.create(task(3));

      expect(await store.list()).toEqual([task(1), task(2), task(3)]);
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
