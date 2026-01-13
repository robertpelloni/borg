import type { Context, Next } from 'hono';
import { SecretManager } from '../managers/SecretManager.js';
import { RbacService, type UserRole, type Permission } from '../services/RbacService.js';

interface SocketWithAuth {
    handshake: {
        auth?: { token?: string };
        query?: { token?: string };
    };
    userRole?: UserRole;
}

export class AuthMiddleware {
    private rbac: RbacService;

    constructor(private secretManager: SecretManager) {
        this.rbac = RbacService.getInstance();
    }

    async verifyHono(c: Context, requiredPermission?: Permission): Promise<{ valid: boolean; role: UserRole; error?: string }> {
        const token = this.extractTokenFromHono(c);
        const expected = this.secretManager.getSecret('SUPER_AI_TOKEN') || 'dev-token';

        if (token !== expected) {
            return { valid: false, role: 'viewer', error: 'Unauthorized' };
        }

        // In dev mode with the master token, we grant 'admin' role
        const role: UserRole = 'admin';
        
        if (requiredPermission && !this.rbac.hasPermission(role, requiredPermission)) {
            return { valid: false, role, error: 'Forbidden' };
        }

        return { valid: true, role };
    }

    requirePermission(permission: Permission) {
        return async (c: Context, next: Next) => {
            const result = await this.verifyHono(c, permission);
            if (!result.valid) {
                if (result.error === 'Forbidden') {
                    return c.json({ error: 'Forbidden: Missing permission ' + permission }, 403);
                }
                return c.json({ error: 'Unauthorized' }, 401);
            }
            c.set('userRole', result.role);
            return next();
        };
    }

    verifySocket(socket: SocketWithAuth, next: (err?: Error) => void) {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        const expected = this.secretManager.getSecret('SUPER_AI_TOKEN') || 'dev-token';

        if (token === expected) {
            socket.userRole = 'admin';
            next();
        } else {
            next(new Error('Unauthorized'));
        }
    }

    private extractTokenFromHono(c: Context): string | null {
        const authHeader = c.req.header('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }
        return c.req.query('token') || null;
    }
}
