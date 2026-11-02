import { buildApp } from './app';
import { storeFromEnv } from './storeFromEnv';

const port = Number(process.env.PORT) || 3000;

buildApp(storeFromEnv(process.env), { logger: true })
  .listen({ port, host: '0.0.0.0' })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
