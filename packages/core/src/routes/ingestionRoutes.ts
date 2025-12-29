import { FastifyInstance } from 'fastify';
import { IngestionManager } from '../managers/IngestionManager.js';
import { MemoryManager } from '../managers/MemoryManager.js';

export async function ingestionRoutes(fastify: FastifyInstance, ingestionManager: IngestionManager) {
    
    fastify.post('/ingest', async (request, reply) => {
        const { source, content, tags } = request.body as any;

        if (!source || !content) {
            return reply.code(400).send({ error: "Missing 'source' or 'content' in request body." });
        }

        try {
            const result = await ingestionManager.ingest(source, content, { tags });
            return result;
        } catch (error: any) {
            request.log.error(error);
            return reply.code(500).send({ error: `Ingestion failed: ${error.message}` });
        }
    });

    fastify.get('/status', async (_request, reply) => {
        return { status: "Ingestion service active" };
    });
}
