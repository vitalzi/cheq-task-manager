import type { FastifyInstance } from 'fastify';
import type { NewTask, TaskService } from './taskService';
import type { TaskChanges } from './taskStore';

// Fastify validates the body against these before the handler runs. The title is trimmed
// first (the transform keyword comes from ajv-keywords, see app.ts), so minLength rejects
// whitespace-only titles and maxLength counts the trimmed text. Priority is 0 high,
// 1 medium, 2 low, done is 0 open or 1 done; null, 1.5, "1" and out-of-range numbers are
// all rejected by the enums.
const title = { type: 'string', transform: ['trim'], minLength: 1, maxLength: 200 };
const priority = { enum: [0, 1, 2] };
const done = { enum: [0, 1] };
const idParams = { type: 'object', properties: { id: { type: 'string' } } };

const createTaskSchema = {
  body: {
    type: 'object',
    required: ['title'],
    // A missing priority becomes 1 (medium). Not for PATCH: there it would reset the priority.
    properties: { title, priority: { ...priority, default: 1 } },
  },
};

// Unknown fields are removed by Fastify's Ajv (additionalProperties false), so id and
// createdAt can never reach the store. anyOf makes a body with none of the three fields a
// 400; minProperties would not do, because it counts the unknown fields before they are removed.
const updateTaskSchema = {
  params: idParams,
  body: {
    type: 'object',
    additionalProperties: false,
    anyOf: [{ required: ['title'] }, { required: ['done'] }, { required: ['priority'] }],
    properties: { title, done, priority },
  },
};

export function registerTaskRoutes(app: FastifyInstance, service: TaskService): void {
  app.get('/tasks', async () => service.list());

  app.post<{ Body: NewTask }>('/tasks', { schema: createTaskSchema }, async (request, reply) => {
    const task = await service.create(request.body);
    return reply.code(201).send(task);
  });

  app.patch<{ Params: { id: string }; Body: TaskChanges }>(
    '/tasks/:id',
    { schema: updateTaskSchema },
    async (request) => service.update(request.params.id, request.body),
  );

  app.delete<{ Params: { id: string } }>(
    '/tasks/:id',
    { schema: { params: idParams } },
    async (request, reply) => {
      await service.delete(request.params.id);
      return reply.code(204).send();
    },
  );
}
