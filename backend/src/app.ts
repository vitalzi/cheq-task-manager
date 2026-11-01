import Fastify, { FastifyError, FastifyInstance } from 'fastify';
import { registerTaskRoutes } from './routes';
import { TaskService, ValidationError } from './taskService';
import type { TaskStore } from './taskStore';

export function buildApp(store: TaskStore): FastifyInstance {
  // Fastify's default Ajv coerces types (42 becomes "42"); we want a wrong type to be a 400.
  const app = Fastify({ ajv: { customOptions: { coerceTypes: false } } });

  app.get('/health', async () => ({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
  }));

  registerTaskRoutes(app, new TaskService(store));

  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: 'Route not found' }));

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof ValidationError) {
      return reply.code(400).send({ error: error.message });
    }
    // Fastify's own 4xx errors: schema validation, malformed JSON, unsupported media type.
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  });

  return app;
}
