import type Ajv from 'ajv';
import ajvKeywords from 'ajv-keywords';
import Fastify, { FastifyError, FastifyInstance, FastifyServerOptions, LogController } from 'fastify';
import { registerTaskRoutes } from './tasks/routes';
import { TaskService } from './tasks/taskService';
import type { TaskStore } from './tasks/store/taskStore';

export interface AppOptions {
  logger?: FastifyServerOptions['logger'];
}

// One log line per request. Request logging is switched off in buildApp, so this is the only one.
function registerRequestLogging(app: FastifyInstance): void {
  app.addHook('onResponse', async (request, reply) => {
    request.log.info({
      method: request.method,
      path: request.url.split('?')[0], // no query string: it may carry sensitive values
      status: reply.statusCode,
      responseTimeMs: reply.elapsedTime,
    });
  });
}

function registerHealthRoute(app: FastifyInstance): void {
  app.get('/health', async () => ({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
  }));
}

function registerNotFoundHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: 'Route not found' }));
}

function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    // Fastify's own 4xx errors: schema validation, malformed JSON, unsupported media type.
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      // Only the PATCH body uses anyOf; Ajv would list "required property" once per field.
      const noFieldGiven = error.validation?.some((e) => e.keyword === 'anyOf');
      const message = noFieldGiven
        ? 'body must include at least one of title, done, priority'
        : error.message;
      return reply.code(error.statusCode).send({ error: message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error' });
  });
}

export function buildApp(store: TaskStore, options: AppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? false,
    // registerRequestLogging writes the one line per request, so Fastify's own is off.
    logController: new LogController({ disableRequestLogging: true }),
    // Fastify's default Ajv coerces types (42 becomes "42"); we want a wrong type to be a 400.
    ajv: {
      customOptions: { coerceTypes: false },
      // Adds the transform keyword (trim). The arrow is needed because Fastify and
      // ajv-keywords type their plugin options differently.
      plugins: [(ajv: Ajv) => ajvKeywords(ajv, ['transform'])],
    },
  });

  registerRequestLogging(app);
  registerHealthRoute(app);
  registerTaskRoutes(app, new TaskService(store));
  registerNotFoundHandler(app);
  registerErrorHandler(app);

  return app;
}
