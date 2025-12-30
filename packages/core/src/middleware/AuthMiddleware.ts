import { FastifyRequest, FastifyReply } from 'fastify';
import { SecretManager } from '../managers/SecretManager.js';

export class AuthMiddleware {
    constructor(private secretManager: SecretManager) {}

    // For Fastify
    async verify(request: FastifyRequest, reply: FastifyReply) {
        const token = this.extractToken(request);
        const expected = this.secretManager.getSecret('SUPER_AI_TOKEN') || 'dev-token'; // Default for alpha

        if (token !== expected) {
            reply.code(401).send({ error: 'Unauthorized' });
            return;
        }
    }

    // For Socket.io
    verifySocket(socket: any, next: (err?: any) => void) {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        const expected = this.secretManager.getSecret('SUPER_AI_TOKEN') || 'dev-token';

        if (token === expected) {
            next();
        } else {
            next(new Error('Unauthorized'));
        }
    }

    private extractToken(req: FastifyRequest): string | null {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }
        return (req.query as any).token || null;
    }
}
