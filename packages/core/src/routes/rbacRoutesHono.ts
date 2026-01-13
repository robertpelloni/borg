import { Hono } from 'hono';
import { RbacService, type UserRole } from '../services/RbacService.js';
import { AuditService } from '../services/AuditService.js';

type Variables = {
  userRole: UserRole;
};

export function createRbacRoutes(): Hono<{ Variables: Variables }> {
  const app = new Hono<{ Variables: Variables }>();
  const rbac = RbacService.getInstance();
  const audit = AuditService.getInstance();

  app.get('/roles', (c) => {
    return c.json({ roles: rbac.listRoles() });
  });

  app.get('/permissions', (c) => {
    const roles = rbac.listRoles();
    const allPermissions = new Set<string>();
    roles.forEach(r => r.permissions.forEach(p => allPermissions.add(p)));
    return c.json({ permissions: Array.from(allPermissions) });
  });

  app.get('/users/:id/role', (c) => {
    const userId = c.req.param('id');
    return c.json({ userId, role: rbac.getUserRole(userId) });
  });

  app.post('/users/:id/role', async (c) => {
    const userId = c.req.param('id');
    const { role } = await c.req.json<{ role: UserRole }>();
    
    try {
      const actor = c.get('userRole') || 'system';
      rbac.assignRole(userId, role);
      audit.logRbacAction(actor, userId, 'assign', { role });
      return c.json({ success: true, userId, role });
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400);
    }
  });

  return app;
}
