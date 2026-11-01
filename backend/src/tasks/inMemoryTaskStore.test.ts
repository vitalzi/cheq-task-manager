import { describeTaskStore } from './taskStore.contract';
import { InMemoryTaskStore } from './inMemoryTaskStore';

describeTaskStore(() => new InMemoryTaskStore());
