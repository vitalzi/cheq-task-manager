import { buildApp } from './app';
import { InMemoryTaskStore } from './tasks/inMemoryTaskStore';

const port = Number(process.env.PORT) || 3000;

buildApp(new InMemoryTaskStore(), { logger: true })
  .listen({ port, host: '0.0.0.0' })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
