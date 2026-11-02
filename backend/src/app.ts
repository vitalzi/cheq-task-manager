import Fastify, { FastifyError, FastifyInstance, FastifyServerOptions, LogController } from 'fastify';
import { registerTaskRoutes } from './tasks/routes';
import { TaskService, ValidationError } from './tasks/taskService';
import type { TaskStore } from './tasks/taskStore';

export interface AppOptions {
  logger?: FastifyServerOptions['logger'];
}

export function buildApp(store: TaskStore, options: AppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? false,
    // We log one line per request ourselves in the onResponse hook below.
    logController: new LogController({ disableRequestLogging: true }),
    // Fastify's default Ajv coerces types (42 becomes "42"); we want a wrong type to be a 400.
    ajv: { customOptions: { coerceTypes: false } },
  });

  app.addHook('onResponse', async (request, reply) => {
    request.log.info({
      method: request.method,
      path: request.url.split('?')[0], // no query string: it may carry sensitive values
      status: reply.statusCode,
      responseTimeMs: reply.elapsedTime,
    });
  });

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
