import { FastifyInstance } from 'fastify';
import { SupervisorPlugin } from '@super-ai/supervisor-plugin';

export const createSupervisorRoutes = (app: FastifyInstance, supervisor: SupervisorPlugin) => {
  app.post('/api/supervisor/task', async (req: any, reply) => {
    try {
      const { task } = req.body;
      
      if (!task) {
        return reply.code(400).send({ error: 'Task is required' });
      }

      // Run in background to not block the request
      supervisor.executeTask(task).catch(err => {
        console.error('Background task execution failed:', err);
      });

      return { status: 'started', message: 'Task execution started' };
    } catch (error: any) {
      console.error('Error starting task:', error);
      return reply.code(500).send({ error: error.message || 'Internal server error' });
    }
  });
};
