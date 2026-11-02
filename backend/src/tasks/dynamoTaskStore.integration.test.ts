import { randomUUID } from 'node:crypto';
import { CreateTableCommand, DeleteTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoTaskStore } from './dynamoTaskStore';
import { describeTaskStore } from './taskStore.contract';

// Needs DynamoDB Local: see "Integration test" in the README.
const raw = new DynamoDBClient({
  endpoint: process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000',
  region: 'local',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' }, // DynamoDB Local ignores them
});
const client = DynamoDBDocumentClient.from(raw);
const tables: string[] = [];

// A new table per test, so no test sees another one's tasks. DynamoDB Local creates
// tables already active, so there is nothing to wait for.
async function createStore(): Promise<DynamoTaskStore> {
  const name = `tasks-${randomUUID()}`;
  await raw.send(
    new CreateTableCommand({
      TableName: name,
      AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
    }),
  );
  tables.push(name);
  return new DynamoTaskStore(name, client);
}

afterAll(async () => {
  await Promise.all(tables.map((TableName) => raw.send(new DeleteTableCommand({ TableName }))));
  client.destroy();
});

describeTaskStore(createStore);
