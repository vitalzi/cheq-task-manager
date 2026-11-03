import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoTaskStore } from './dynamoTaskStore';
import { InMemoryTaskStore } from './inMemoryTaskStore';
import type { TaskStore } from './taskStore';

// TABLE_NAME is set by Terraform in the deployed container. Locally it is unset,
// so development still needs nothing but Node. Region and credentials come from
// the container's own environment (AWS_REGION and the ECS task role).
export function storeFromEnv(env: NodeJS.ProcessEnv): TaskStore {
  if (env.TABLE_NAME) {
    return new DynamoTaskStore(env.TABLE_NAME, DynamoDBDocumentClient.from(new DynamoDBClient({})));
  }
  return new InMemoryTaskStore();
}
