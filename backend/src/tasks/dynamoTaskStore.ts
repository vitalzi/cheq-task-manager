import { PutCommand, ScanCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { Task, TaskStore } from './taskStore';

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
}
