import { EventEmitter } from 'events';

export type UserRole = 'admin' | 'developer' | 'operator' | 'viewer';

export type Permission = 
  | 'agent:run'
  | 'agent:manage'
  | 'council:debate'
  | 'council:manage'
  | 'architect:session'
  | 'system:config'
  | 'system:status'
  | 'audit:read'
  | 'secrets:manage'
  | 'memory:read'
  | 'memory:write';

export interface RoleDefinition {
  role: UserRole;
  permissions: Permission[];
  description: string;
}

export class RbacService extends EventEmitter {
  private static instance: RbacService | null = null;
  private roles: Map<UserRole, RoleDefinition> = new Map();
  private userRoles: Map<string, UserRole> = new Map(); // token -> role mapping for dev

  private constructor() {
    super();
    this.initializeDefaultRoles();
  }

  static getInstance(): RbacService {
    if (!RbacService.instance) {
      RbacService.instance = new RbacService();
    }
    return RbacService.instance;
  }

  private initializeDefaultRoles(): void {
    const defaultRoles: RoleDefinition[] = [
      {
        role: 'admin',
        description: 'Full system access',
        permissions: [
          'agent:run', 'agent:manage', 'council:debate', 'council:manage',
          'architect:session', 'system:config', 'system:status', 'audit:read',
          'secrets:manage', 'memory:read', 'memory:write'
        ]
      },
      {
        role: 'developer',
        description: 'Access to agent and memory development',
        permissions: [
          'agent:run', 'agent:manage', 'council:debate', 'architect:session',
          'system:status', 'memory:read', 'memory:write'
        ]
      },
      {
        role: 'operator',
        description: 'Access to run agents and view status',
        permissions: [
          'agent:run', 'council:debate', 'system:status', 'memory:read'
        ]
      },
      {
        role: 'viewer',
        description: 'Read-only access to status',
        permissions: [
          'system:status'
        ]
      }
    ];

    for (const def of defaultRoles) {
      this.roles.set(def.role, def);
    }
  }

  hasPermission(role: UserRole, permission: Permission): boolean {
    const def = this.roles.get(role);
    if (!def) return false;
    return def.permissions.includes(permission);
  }

  getPermissions(role: UserRole): Permission[] {
    return this.roles.get(role)?.permissions || [];
  }

  assignRole(userId: string, role: UserRole): void {
    if (!this.roles.has(role)) {
      throw new Error(`Invalid role: ${role}`);
    }
    this.userRoles.set(userId, role);
    this.emit('role_assigned', { userId, role });
  }

  getUserRole(userId: string): UserRole {
    // For now, if no role assigned, default to viewer
    return this.userRoles.get(userId) || 'viewer';
  }

  listRoles(): RoleDefinition[] {
    return Array.from(this.roles.values());
  }
}
