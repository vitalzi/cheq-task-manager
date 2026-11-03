import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, PutCommand, ScanCommand, UpdateCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { Task, TaskChanges, TaskStore } from './taskStore';

// Both writes below carry this condition, so an unknown id fails instead of creating an item.
const ITEM_EXISTS = 'attribute_exists(id)';

// The table has `id` as its only key (see infra/dynamodb.tf).
export class DynamoTaskStore implements TaskStore {
  constructor(
    private readonly tableName: string,
    private readonly client: DynamoDBDocumentClient,
  ) {}

  async list(): Promise<Task[]> {
    const tasks: Task[] = [];
    let startKey: Record<string, unknown> | undefined;
    // A scan returns at most 1 MB per call; keep going until DynamoDB stops returning a key
    do {
      // Strongly consistent: the UI lists right after a create, and the default (eventually
      // consistent) read could miss the task just written. Costs twice the read units.
      const page = await this.client.send(
        new ScanCommand({ TableName: this.tableName, ExclusiveStartKey: startKey, ConsistentRead: true }),
      );
      tasks.push(...((page.Items ?? []) as Task[]));
      startKey = page.LastEvaluatedKey;
    } while (startKey);
    // Items come back in hash order. ISO 8601 UTC strings sort by time as plain text.
    return tasks.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  }

  async create(task: Task): Promise<Task> {
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: task }));
    return task;
  }

  async update(id: string, changes: TaskChanges): Promise<Task | undefined> {
    // Only the fields that were given, so the others (and id, createdAt) are left alone.
    // `changes` is never empty here: the route rejects a body with nothing to change.
    const fields = Object.entries(changes).filter(([, value]) => value !== undefined);
    try {
      const result = await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { id },
          UpdateExpression: `SET ${fields.map(([name]) => `#${name} = :${name}`).join(', ')}`,
          ExpressionAttributeNames: Object.fromEntries(fields.map(([name]) => [`#${name}`, name])),
          ExpressionAttributeValues: Object.fromEntries(fields.map(([name, value]) => [`:${name}`, value])),
          ConditionExpression: ITEM_EXISTS,
          ReturnValues: 'ALL_NEW',
        }),
      );
      return result.Attributes as Task;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return undefined;
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.client.send(
        new DeleteCommand({ TableName: this.tableName, Key: { id }, ConditionExpression: ITEM_EXISTS }),
      );
      return true;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return false;
      throw error;
    }
  }
}
