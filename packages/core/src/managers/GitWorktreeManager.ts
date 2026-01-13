import { spawn, execSync } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface WorktreeConfig {
  baseDir: string;
  maxWorktrees?: number;
  cleanupOnExit?: boolean;
  defaultBranch?: string;
}

export interface Worktree {
  id: string;
  path: string;
  branch: string;
  agentId: string | null;
  createdAt: Date;
  status: 'available' | 'in_use' | 'merging' | 'error';
  lastActivity?: Date;
}

export interface WorktreeResult {
  worktreeId: string;
  success: boolean;
  files: string[];
  commits: string[];
  conflicts?: string[];
  error?: string;
}

export interface MergeResult {
  success: boolean;
  mergedCommits: number;
  conflicts: string[];
  resolvedAutomatically: boolean;
}

export class GitWorktreeManager extends EventEmitter {
  private config: Required<WorktreeConfig>;
  private worktrees: Map<string, Worktree> = new Map();
  private worktreeDir: string;

  constructor(config: WorktreeConfig) {
    super();
    this.config = {
      baseDir: config.baseDir,
      maxWorktrees: config.maxWorktrees ?? 5,
      cleanupOnExit: config.cleanupOnExit ?? true,
      defaultBranch: config.defaultBranch ?? 'main',
    };
    this.worktreeDir = path.join(this.config.baseDir, '.aios-worktrees');
    
    if (!fs.existsSync(this.worktreeDir)) {
      fs.mkdirSync(this.worktreeDir, { recursive: true });
    }

    this.loadExistingWorktrees();

    if (this.config.cleanupOnExit) {
      process.on('exit', () => this.cleanupAll());
      process.on('SIGINT', () => { this.cleanupAll(); process.exit(); });
      process.on('SIGTERM', () => { this.cleanupAll(); process.exit(); });
    }
  }

  private loadExistingWorktrees(): void {
    try {
      const output = execSync('git worktree list --porcelain', {
        cwd: this.config.baseDir,
        encoding: 'utf-8',
      });

      const worktreeBlocks = output.split('\n\n').filter(Boolean);
      
      for (const block of worktreeBlocks) {
        const lines = block.split('\n');
        const worktreePath = lines[0]?.replace('worktree ', '');
        const branch = lines.find(l => l.startsWith('branch '))?.replace('branch refs/heads/', '');
        
        if (worktreePath?.includes('.aios-worktrees') && branch) {
          const id = path.basename(worktreePath);
          this.worktrees.set(id, {
            id,
            path: worktreePath,
            branch,
            agentId: null,
            createdAt: new Date(),
            status: 'available',
          });
        }
      }
    } catch {
      // No existing worktrees or git command failed
    }
  }

  async createWorktree(agentId?: string): Promise<Worktree> {
    if (this.worktrees.size >= this.config.maxWorktrees) {
      const available = this.getAvailableWorktree();
      if (available) {
        return this.assignWorktree(available.id, agentId);
      }
      throw new Error(`Maximum worktrees (${this.config.maxWorktrees}) reached`);
    }

    const id = `wt-${crypto.randomBytes(4).toString('hex')}`;
    const branch = `agent/${id}`;
    const worktreePath = path.join(this.worktreeDir, id);

    try {
      execSync(`git branch ${branch} ${this.config.defaultBranch}`, {
        cwd: this.config.baseDir,
        stdio: 'pipe',
      });

      execSync(`git worktree add "${worktreePath}" ${branch}`, {
        cwd: this.config.baseDir,
        stdio: 'pipe',
      });

      const worktree: Worktree = {
        id,
        path: worktreePath,
        branch,
        agentId: agentId ?? null,
        createdAt: new Date(),
        status: agentId ? 'in_use' : 'available',
        lastActivity: new Date(),
      };

      this.worktrees.set(id, worktree);
      this.emit('worktreeCreated', { worktree });
      
      return worktree;
    } catch (error) {
      this.emit('error', { error, operation: 'createWorktree', id });
      throw error;
    }
  }

  private getAvailableWorktree(): Worktree | undefined {
    return Array.from(this.worktrees.values()).find(w => w.status === 'available');
  }

  assignWorktree(worktreeId: string, agentId?: string): Worktree {
    const worktree = this.worktrees.get(worktreeId);
    if (!worktree) {
      throw new Error(`Worktree ${worktreeId} not found`);
    }
    if (worktree.status !== 'available') {
      throw new Error(`Worktree ${worktreeId} is not available`);
    }

    worktree.agentId = agentId ?? null;
    worktree.status = 'in_use';
    worktree.lastActivity = new Date();
    
    this.emit('worktreeAssigned', { worktree, agentId });
    return worktree;
  }

  releaseWorktree(worktreeId: string): void {
    const worktree = this.worktrees.get(worktreeId);
    if (!worktree) return;

    worktree.agentId = null;
    worktree.status = 'available';
    worktree.lastActivity = new Date();
    
    this.emit('worktreeReleased', { worktreeId });
  }

  async getOrCreateWorktree(agentId: string): Promise<Worktree> {
    const existing = Array.from(this.worktrees.values()).find(
      w => w.agentId === agentId && w.status === 'in_use'
    );
    
    if (existing) return existing;

    const available = this.getAvailableWorktree();
    if (available) {
      return this.assignWorktree(available.id, agentId);
    }

    return this.createWorktree(agentId);
  }

  async syncWithMain(worktreeId: string): Promise<{ success: boolean; conflicts: string[] }> {
    const worktree = this.worktrees.get(worktreeId);
    if (!worktree) {
      throw new Error(`Worktree ${worktreeId} not found`);
    }

    try {
      execSync(`git fetch origin ${this.config.defaultBranch}`, {
        cwd: worktree.path,
        stdio: 'pipe',
      });

      try {
        execSync(`git merge origin/${this.config.defaultBranch} --no-edit`, {
          cwd: worktree.path,
          stdio: 'pipe',
        });
        return { success: true, conflicts: [] };
      } catch {
        const status = execSync('git status --porcelain', {
          cwd: worktree.path,
          encoding: 'utf-8',
        });
        
        const conflicts = status
          .split('\n')
          .filter(line => line.startsWith('UU ') || line.startsWith('AA '))
          .map(line => line.slice(3));

        if (conflicts.length > 0) {
          execSync('git merge --abort', { cwd: worktree.path, stdio: 'pipe' });
          return { success: false, conflicts };
        }
        
        throw new Error('Merge failed with unknown error');
      }
    } catch (error) {
      this.emit('error', { error, operation: 'syncWithMain', worktreeId });
      throw error;
    }
  }

  async mergeToMain(worktreeId: string, commitMessage?: string): Promise<MergeResult> {
    const worktree = this.worktrees.get(worktreeId);
    if (!worktree) {
      throw new Error(`Worktree ${worktreeId} not found`);
    }

    worktree.status = 'merging';
    this.emit('mergeStarted', { worktreeId });

    try {
      const hasChanges = execSync('git status --porcelain', {
        cwd: worktree.path,
        encoding: 'utf-8',
      }).trim();

      if (hasChanges) {
        execSync('git add -A', { cwd: worktree.path, stdio: 'pipe' });
        const msg = commitMessage || `Agent ${worktree.agentId || worktreeId} changes`;
        execSync(`git commit -m "${msg}"`, { cwd: worktree.path, stdio: 'pipe' });
      }

      const commitCount = parseInt(
        execSync(`git rev-list --count ${this.config.defaultBranch}..${worktree.branch}`, {
          cwd: worktree.path,
          encoding: 'utf-8',
        }).trim()
      ) || 0;

      execSync(`git checkout ${this.config.defaultBranch}`, {
        cwd: this.config.baseDir,
        stdio: 'pipe',
      });

      try {
        execSync(`git merge ${worktree.branch} --no-edit`, {
          cwd: this.config.baseDir,
          stdio: 'pipe',
        });

        const result: MergeResult = {
          success: true,
          mergedCommits: commitCount,
          conflicts: [],
          resolvedAutomatically: false,
        };

        worktree.status = 'available';
        this.emit('mergeComplete', { worktreeId, result });
        return result;
      } catch {
        const status = execSync('git status --porcelain', {
          cwd: this.config.baseDir,
          encoding: 'utf-8',
        });

        const conflicts = status
          .split('\n')
          .filter(line => line.startsWith('UU ') || line.startsWith('AA '))
          .map(line => line.slice(3));

        worktree.status = 'error';
        
        const result: MergeResult = {
          success: false,
          mergedCommits: 0,
          conflicts,
          resolvedAutomatically: false,
        };

        this.emit('mergeConflict', { worktreeId, conflicts });
        return result;
      }
    } catch (error) {
      worktree.status = 'error';
      this.emit('error', { error, operation: 'mergeToMain', worktreeId });
      throw error;
    }
  }

  async removeWorktree(worktreeId: string, force = false): Promise<void> {
    const worktree = this.worktrees.get(worktreeId);
    if (!worktree) return;

    try {
      const forceFlag = force ? '--force' : '';
      execSync(`git worktree remove "${worktree.path}" ${forceFlag}`, {
        cwd: this.config.baseDir,
        stdio: 'pipe',
      });

      try {
        execSync(`git branch -D ${worktree.branch}`, {
          cwd: this.config.baseDir,
          stdio: 'pipe',
        });
      } catch {
        // Branch may already be deleted
      }

      this.worktrees.delete(worktreeId);
      this.emit('worktreeRemoved', { worktreeId });
    } catch (error) {
      if (force) {
        if (fs.existsSync(worktree.path)) {
          fs.rmSync(worktree.path, { recursive: true, force: true });
        }
        this.worktrees.delete(worktreeId);
      } else {
        throw error;
      }
    }
  }

  getWorktree(worktreeId: string): Worktree | undefined {
    return this.worktrees.get(worktreeId);
  }

  listWorktrees(): Worktree[] {
    return Array.from(this.worktrees.values());
  }

  getWorktreeForAgent(agentId: string): Worktree | undefined {
    return Array.from(this.worktrees.values()).find(
      w => w.agentId === agentId && w.status === 'in_use'
    );
  }

  async getWorktreeStatus(worktreeId: string): Promise<WorktreeResult> {
    const worktree = this.worktrees.get(worktreeId);
    if (!worktree) {
      return { worktreeId, success: false, files: [], commits: [], error: 'Worktree not found' };
    }

    try {
      const status = execSync('git status --porcelain', {
        cwd: worktree.path,
        encoding: 'utf-8',
      });

      const files = status.split('\n').filter(Boolean).map(line => line.slice(3));

      const commits = execSync(
        `git log ${this.config.defaultBranch}..HEAD --oneline`,
        { cwd: worktree.path, encoding: 'utf-8' }
      ).split('\n').filter(Boolean);

      return {
        worktreeId,
        success: true,
        files,
        commits,
      };
    } catch (error) {
      return {
        worktreeId,
        success: false,
        files: [],
        commits: [],
        error: (error as Error).message,
      };
    }
  }

  cleanupAll(): void {
    for (const worktree of this.worktrees.values()) {
      try {
        this.removeWorktree(worktree.id, true);
      } catch {
        // Best effort cleanup
      }
    }
  }

  async resetWorktree(worktreeId: string): Promise<void> {
    const worktree = this.worktrees.get(worktreeId);
    if (!worktree) {
      throw new Error(`Worktree ${worktreeId} not found`);
    }

    execSync('git reset --hard HEAD', { cwd: worktree.path, stdio: 'pipe' });
    execSync('git clean -fd', { cwd: worktree.path, stdio: 'pipe' });
    
    worktree.lastActivity = new Date();
    this.emit('worktreeReset', { worktreeId });
  }

  getStats(): { total: number; available: number; inUse: number; error: number } {
    const worktrees = Array.from(this.worktrees.values());
    return {
      total: worktrees.length,
      available: worktrees.filter(w => w.status === 'available').length,
      inUse: worktrees.filter(w => w.status === 'in_use').length,
      error: worktrees.filter(w => w.status === 'error').length,
    };
  }
}
