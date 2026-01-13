import { describe, test, expect, beforeEach } from 'bun:test';
import { RbacService, type UserRole, type Permission } from '../../src/services/RbacService.ts';

describe('RbacService', () => {
  let rbac: RbacService;

  beforeEach(() => {
    rbac = RbacService.getInstance();
  });

  test('should have default roles configured', () => {
    const roles = rbac.listRoles();
    expect(roles.length).toBe(4);
    expect(roles.map(r => r.role)).toContain('admin');
    expect(roles.map(r => r.role)).toContain('viewer');
  });

  test('admin should have all permissions', () => {
    const adminPermissions = rbac.getPermissions('admin');
    expect(adminPermissions).toContain('agent:run');
    expect(adminPermissions).toContain('secrets:manage');
    expect(adminPermissions).toContain('audit:read');
  });

  test('viewer should have limited permissions', () => {
    const viewerPermissions = rbac.getPermissions('viewer');
    expect(viewerPermissions).toContain('system:status');
    expect(viewerPermissions).not.toContain('agent:run');
    expect(viewerPermissions).not.toContain('secrets:manage');
  });

  test('should verify permissions correctly', () => {
    expect(rbac.hasPermission('admin', 'agent:run')).toBe(true);
    expect(rbac.hasPermission('viewer', 'agent:run')).toBe(false);
    expect(rbac.hasPermission('developer', 'agent:run')).toBe(true);
    expect(rbac.hasPermission('operator', 'audit:read')).toBe(false);
  });

  test('should assign roles to users', () => {
    rbac.assignRole('user-1', 'developer');
    expect(rbac.getUserRole('user-1')).toBe('developer');
    
    rbac.assignRole('user-2', 'viewer');
    expect(rbac.getUserRole('user-2')).toBe('viewer');
  });

  test('should default to viewer for unknown users', () => {
    expect(rbac.getUserRole('unknown-user')).toBe('viewer');
  });

  test('should throw error for invalid role assignment', () => {
    expect(() => rbac.assignRole('user-1', 'invalid-role' as any)).toThrow(/invalid role/i);
  });
});
