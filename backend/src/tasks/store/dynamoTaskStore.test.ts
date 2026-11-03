import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoTaskStore } from './dynamoTaskStore';
import type { Task } from './taskStore';

// Unit tests with a fake client for what DynamoDB Local cannot show cheaply:
// following a paginated Scan (DynamoDB returns at most 1 MB per page) and the
// table name wiring. The shared contract test runs against the real thing in
// dynamoTaskStore.integration.test.ts.
describe('DynamoTaskStore', () => {
  const task = (n: number): Task => ({ id: `id-${n}`, title: `Task ${n}`, createdAt: `2026-11-02T09:30:0${n}Z`, done: 0, priority: 1 });

  const storeWith = (send: jest.Mock) => new DynamoTaskStore('tasks', { send } as unknown as DynamoDBDocumentClient);

  it('follows LastEvaluatedKey until the scan is complete and sorts across pages', async () => {
    const send = jest
      .fn()
      .mockResolvedValueOnce({ Items: [task(3), task(1)], LastEvaluatedKey: { id: 'id-1' } })
      .mockResolvedValueOnce({ Items: [task(2)] });

    const listed = await storeWith(send).list();

    expect(listed).toEqual([task(1), task(2), task(3)]);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0].input).toMatchObject({ TableName: 'tasks', ExclusiveStartKey: { id: 'id-1' } });
  });

  it('reads with strong consistency on every page, so a task created a moment ago is listed', async () => {
    const send = jest
      .fn()
      .mockResolvedValueOnce({ Items: [task(1)], LastEvaluatedKey: { id: 'id-1' } })
      .mockResolvedValueOnce({ Items: [task(2)] });

    await storeWith(send).list();

    expect(send.mock.calls.map((call) => call[0].input.ConsistentRead)).toEqual([true, true]);
  });

  it('lists nothing when the scan returns no items', async () => {
    const send = jest.fn().mockResolvedValueOnce({});

    expect(await storeWith(send).list()).toEqual([]);
  });

  it('writes the task to the configured table and returns it', async () => {
    const send = jest.fn().mockResolvedValueOnce({});

    const created = await storeWith(send).create(task(1));

    expect(created).toEqual(task(1));
    expect(send.mock.calls[0][0].input).toEqual({ TableName: 'tasks', Item: task(1) });
  });

  const conditionFailed = () => new ConditionalCheckFailedException({ message: 'The conditional request failed', $metadata: {} });

  describe('update', () => {
    it('sets only the given fields, only on an existing item, and returns the new item', async () => {
      const send = jest.fn().mockResolvedValueOnce({ Attributes: { ...task(1), done: 1 } });

      const updated = await storeWith(send).update('id-1', { done: 1, priority: 0 });

      expect(updated).toEqual({ ...task(1), done: 1 });
      expect(send.mock.calls[0][0].input).toEqual({
        TableName: 'tasks',
        Key: { id: 'id-1' },
        UpdateExpression: 'SET #done = :done, #priority = :priority',
        ExpressionAttributeNames: { '#done': 'done', '#priority': 'priority' },
        ExpressionAttributeValues: { ':done': 1, ':priority': 0 },
        ConditionExpression: 'attribute_exists(id)',
        ReturnValues: 'ALL_NEW',
      });
    });

    it('returns undefined when the item does not exist', async () => {
      const send = jest.fn().mockRejectedValueOnce(conditionFailed());

      expect(await storeWith(send).update('missing', { done: 1 })).toBeUndefined();
    });

    it('rethrows any other error', async () => {
      const send = jest.fn().mockRejectedValueOnce(new Error('throttled'));

      await expect(storeWith(send).update('id-1', { done: 1 })).rejects.toThrow('throttled');
    });
  });

  describe('delete', () => {
    it('deletes only an existing item and returns true', async () => {
      const send = jest.fn().mockResolvedValueOnce({});

      expect(await storeWith(send).delete('id-1')).toBe(true);
      expect(send.mock.calls[0][0].input).toEqual({
        TableName: 'tasks',
        Key: { id: 'id-1' },
        ConditionExpression: 'attribute_exists(id)',
      });
    });

    it('returns false when the item does not exist', async () => {
      const send = jest.fn().mockRejectedValueOnce(conditionFailed());

      expect(await storeWith(send).delete('missing')).toBe(false);
    });

    it('rethrows any other error', async () => {
      const send = jest.fn().mockRejectedValueOnce(new Error('throttled'));

      await expect(storeWith(send).delete('id-1')).rejects.toThrow('throttled');
    });
  });
});
