import { EventEmitter } from 'events';

export interface ToolAnnotation {
  toolName: string;
  serverName: string;
  displayName?: string;
  category?: string;
  tags?: string[];
  uiHints?: ToolUiHints;
  examples?: ToolExample[];
  permissions?: ToolPermissions;
  customMetadata?: Record<string, unknown>;
  updatedAt: number;
}

export interface ToolUiHints {
  icon?: string;
  color?: string;
  group?: string;
  sortOrder?: number;
  hidden?: boolean;
  deprecated?: boolean;
  deprecationMessage?: string;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
}

export interface ToolExample {
  name: string;
  description?: string;
  input: Record<string, unknown>;
  expectedOutput?: string;
}

export interface ToolPermissions {
  requiredRoles?: string[];
  maxCallsPerMinute?: number;
  allowedAgents?: string[];
  blockedAgents?: string[];
  requiresApproval?: boolean;
}

export class ToolAnnotationManager extends EventEmitter {
  private annotations: Map<string, ToolAnnotation> = new Map();
  private categories: Set<string> = new Set();

  private makeKey(serverName: string, toolName: string): string {
    return `${serverName}::${toolName}`;
  }

  setAnnotation(
    serverName: string,
    toolName: string,
    annotation: Partial<Omit<ToolAnnotation, 'toolName' | 'serverName' | 'updatedAt'>>
  ): ToolAnnotation {
    const key = this.makeKey(serverName, toolName);
    const existing = this.annotations.get(key);

    const updated: ToolAnnotation = {
      ...existing,
      ...annotation,
      toolName,
      serverName,
      updatedAt: Date.now(),
    };

    if (annotation.category) {
      this.categories.add(annotation.category);
    }

    this.annotations.set(key, updated);
    this.emit('annotationUpdated', updated);
    return updated;
  }

  getAnnotation(serverName: string, toolName: string): ToolAnnotation | null {
    return this.annotations.get(this.makeKey(serverName, toolName)) ?? null;
  }

  removeAnnotation(serverName: string, toolName: string): boolean {
    const key = this.makeKey(serverName, toolName);
    const removed = this.annotations.delete(key);
    if (removed) {
      this.emit('annotationRemoved', { serverName, toolName });
    }
    return removed;
  }

  getAllAnnotations(): ToolAnnotation[] {
    return Array.from(this.annotations.values());
  }

  getAnnotationsByServer(serverName: string): ToolAnnotation[] {
    return this.getAllAnnotations().filter(a => a.serverName === serverName);
  }

  getAnnotationsByCategory(category: string): ToolAnnotation[] {
    return this.getAllAnnotations().filter(a => a.category === category);
  }

  getAnnotationsByTag(tag: string): ToolAnnotation[] {
    return this.getAllAnnotations().filter(a => a.tags?.includes(tag));
  }

  getCategories(): string[] {
    return Array.from(this.categories);
  }

  getAllTags(): string[] {
    const tags = new Set<string>();
    for (const annotation of this.annotations.values()) {
      annotation.tags?.forEach(t => tags.add(t));
    }
    return Array.from(tags);
  }

  setUiHints(serverName: string, toolName: string, hints: ToolUiHints): ToolAnnotation {
    return this.setAnnotation(serverName, toolName, { uiHints: hints });
  }

  addExample(serverName: string, toolName: string, example: ToolExample): ToolAnnotation {
    const existing = this.getAnnotation(serverName, toolName);
    const examples = [...(existing?.examples ?? []), example];
    return this.setAnnotation(serverName, toolName, { examples });
  }

  setPermissions(serverName: string, toolName: string, permissions: ToolPermissions): ToolAnnotation {
    return this.setAnnotation(serverName, toolName, { permissions });
  }

  getVisibleTools(serverName?: string): ToolAnnotation[] {
    let tools = this.getAllAnnotations();
    if (serverName) {
      tools = tools.filter(a => a.serverName === serverName);
    }
    return tools.filter(a => !a.uiHints?.hidden);
  }

  getDeprecatedTools(): ToolAnnotation[] {
    return this.getAllAnnotations().filter(a => a.uiHints?.deprecated);
  }

  getToolsRequiringConfirmation(): ToolAnnotation[] {
    return this.getAllAnnotations().filter(a => a.uiHints?.requiresConfirmation);
  }

  getToolsForAgent(agentName: string): ToolAnnotation[] {
    return this.getAllAnnotations().filter(a => {
      const perms = a.permissions;
      if (!perms) return true;
      if (perms.blockedAgents?.includes(agentName)) return false;
      if (perms.allowedAgents && !perms.allowedAgents.includes(agentName)) return false;
      return true;
    });
  }

  bulkSetAnnotations(annotations: Array<{
    serverName: string;
    toolName: string;
    annotation: Partial<Omit<ToolAnnotation, 'toolName' | 'serverName' | 'updatedAt'>>;
  }>): void {
    for (const { serverName, toolName, annotation } of annotations) {
      this.setAnnotation(serverName, toolName, annotation);
    }
    this.emit('bulkUpdate', annotations.length);
  }

  exportAnnotations(): ToolAnnotation[] {
    return this.getAllAnnotations();
  }

  importAnnotations(annotations: ToolAnnotation[]): number {
    let count = 0;
    for (const annotation of annotations) {
      this.setAnnotation(annotation.serverName, annotation.toolName, annotation);
      count++;
    }
    return count;
  }

  getStatus(): {
    totalAnnotations: number;
    categories: number;
    tags: number;
    hiddenTools: number;
    deprecatedTools: number;
  } {
    const all = this.getAllAnnotations();
    return {
      totalAnnotations: all.length,
      categories: this.categories.size,
      tags: this.getAllTags().length,
      hiddenTools: all.filter(a => a.uiHints?.hidden).length,
      deprecatedTools: all.filter(a => a.uiHints?.deprecated).length,
    };
  }
}
