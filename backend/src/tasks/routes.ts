import type { FastifyInstance } from 'fastify';
import type { NewTask, TaskService } from './taskService';

// Fastify validates the body against this before the handler runs. The title is
// trimmed first (the transform keyword comes from ajv-keywords, see app.ts), so minLength
// rejects whitespace-only titles and maxLength counts the trimmed text. Priority is
// 0 high, 1 medium, 2 low; a missing one becomes 1, and null, 1.5, "1" and 3 are all
// rejected by the enum.
const createTaskSchema = {
  body: {
    type: 'object',
    required: ['title'],
    properties: {
      title: { type: 'string', transform: ['trim'], minLength: 1, maxLength: 200 },
      priority: { enum: [0, 1, 2], default: 1 },
    },
  },
};

export function registerTaskRoutes(app: FastifyInstance, service: TaskService): void {
  app.get('/tasks', async () => service.list());

  app.post<{ Body: NewTask }>('/tasks', { schema: createTaskSchema }, async (request, reply) => {
    const task = await service.create(request.body);
    return reply.code(201).send(task);
  });
}
