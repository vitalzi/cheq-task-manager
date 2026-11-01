import type { FastifyInstance } from 'fastify';
import type { TaskService } from './taskService';

// Only the type is checked here. Length is checked by the service, after trimming.
const createTaskSchema = {
  body: {
    type: 'object',
    required: ['title'],
    properties: { title: { type: 'string' } },
  },
};

export function registerTaskRoutes(app: FastifyInstance, service: TaskService): void {
  app.get('/tasks', async () => service.list());

  app.post<{ Body: { title: string } }>('/tasks', { schema: createTaskSchema }, async (request, reply) => {
    const task = await service.create(request.body.title);
    return reply.code(201).send(task);
  });
}
