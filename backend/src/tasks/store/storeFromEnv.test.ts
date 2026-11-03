import { DynamoTaskStore } from './dynamoTaskStore';
import { InMemoryTaskStore } from './inMemoryTaskStore';
import { storeFromEnv } from './storeFromEnv';

describe('storeFromEnv', () => {
  it('uses DynamoDB when TABLE_NAME is set', () => {
    expect(storeFromEnv({ TABLE_NAME: 'task-manager-tasks' })).toBeInstanceOf(DynamoTaskStore);
  });

  it('uses the in-memory store when TABLE_NAME is not set, so local development needs nothing', () => {
    expect(storeFromEnv({})).toBeInstanceOf(InMemoryTaskStore);
  });

  it('treats an empty TABLE_NAME as not set', () => {
    expect(storeFromEnv({ TABLE_NAME: '' })).toBeInstanceOf(InMemoryTaskStore);
  });
});
