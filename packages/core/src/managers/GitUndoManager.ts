import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

export interface FileChange {
  filePath: string;
  changeType: 'create' | 'modify' | 'delete';
  previousContent?: string;
  newContent?: string;
  timestamp: number;
}

export interface UndoEntry {
  id: string;
  sessionId: string;
  description: string;
  changes: FileChange[];
  timestamp: number;
  committed: boolean;
  commitHash?: string;
}

export interface GitUndoManagerConfig {
  projectRoot: string;
  maxUndoEntries?: number;
  autoCommit?: boolean;
}

export class GitUndoManager extends EventEmitter {
  private projectRoot: string;
  private undoStack: UndoEntry[] = [];
  private redoStack: UndoEntry[] = [];
  private maxEntries: number;
  private autoCommit: boolean;
  private currentEntry: UndoEntry | null = null;

  constructor(config: GitUndoManagerConfig) {
    super();
    this.projectRoot = config.projectRoot;
    this.maxEntries = config.maxUndoEntries ?? 50;
    this.autoCommit = config.autoCommit ?? false;
  }

  private async execGit(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn('git', args, {
        cwd: this.projectRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => { stdout += data.toString(); });
      proc.stderr?.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Git command failed: ${stderr || stdout}`));
        }
      });

      proc.on('error', reject);
    });
  }

  async isGitRepo(): Promise<boolean> {
    try {
      await this.execGit(['rev-parse', '--git-dir']);
      return true;
    } catch {
      return false;
    }
  }

  async startChangeGroup(sessionId: string, description: string): Promise<string> {
    const id = `undo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.currentEntry = {
      id,
      sessionId,
      description,
      changes: [],
      timestamp: Date.now(),
      committed: false,
    };
    return id;
  }

  async trackFileChange(
    filePath: string,
    changeType: 'create' | 'modify' | 'delete',
    previousContent?: string
  ): Promise<void> {
    if (!this.currentEntry) {
      throw new Error('No active change group. Call startChangeGroup first.');
    }

    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(this.projectRoot, filePath);

    let newContent: string | undefined;
    if (changeType !== 'delete') {
      try {
        newContent = await fs.readFile(absolutePath, 'utf-8');
      } catch {
        newContent = undefined;
      }
    }

    this.currentEntry.changes.push({
      filePath: path.relative(this.projectRoot, absolutePath),
      changeType,
      previousContent,
      newContent,
      timestamp: Date.now(),
    });
  }

  async commitChangeGroup(): Promise<UndoEntry> {
    if (!this.currentEntry) {
      throw new Error('No active change group to commit.');
    }

    const entry = this.currentEntry;
    this.currentEntry = null;

    if (entry.changes.length === 0) {
      throw new Error('No changes to commit.');
    }

    if (this.autoCommit && await this.isGitRepo()) {
      try {
        const filePaths = entry.changes.map(c => c.filePath);
        await this.execGit(['add', ...filePaths]);
        await this.execGit(['commit', '-m', `[AIOS] ${entry.description}`]);
        entry.commitHash = await this.execGit(['rev-parse', 'HEAD']);
        entry.committed = true;
      } catch (err) {
        console.error('[GitUndoManager] Failed to auto-commit:', err);
      }
    }

    this.undoStack.push(entry);
    this.redoStack = [];

    while (this.undoStack.length > this.maxEntries) {
      this.undoStack.shift();
    }

    this.emit('changeCommitted', entry);
    return entry;
  }

  async undo(): Promise<UndoEntry | null> {
    const entry = this.undoStack.pop();
    if (!entry) return null;

    for (const change of [...entry.changes].reverse()) {
      const absolutePath = path.join(this.projectRoot, change.filePath);

      switch (change.changeType) {
        case 'create':
          try {
            await fs.unlink(absolutePath);
          } catch {}
          break;
        case 'modify':
          if (change.previousContent !== undefined) {
            await fs.writeFile(absolutePath, change.previousContent, 'utf-8');
          }
          break;
        case 'delete':
          if (change.previousContent !== undefined) {
            const dir = path.dirname(absolutePath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(absolutePath, change.previousContent, 'utf-8');
          }
          break;
      }
    }

    if (entry.committed && entry.commitHash && await this.isGitRepo()) {
      try {
        await this.execGit(['revert', '--no-commit', entry.commitHash]);
        await this.execGit(['commit', '-m', `[AIOS] Undo: ${entry.description}`]);
      } catch (err) {
        console.error('[GitUndoManager] Git revert failed:', err);
      }
    }

    this.redoStack.push(entry);
    this.emit('undone', entry);
    return entry;
  }

  async redo(): Promise<UndoEntry | null> {
    const entry = this.redoStack.pop();
    if (!entry) return null;

    for (const change of entry.changes) {
      const absolutePath = path.join(this.projectRoot, change.filePath);

      switch (change.changeType) {
        case 'create':
        case 'modify':
          if (change.newContent !== undefined) {
            const dir = path.dirname(absolutePath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(absolutePath, change.newContent, 'utf-8');
          }
          break;
        case 'delete':
          try {
            await fs.unlink(absolutePath);
          } catch {}
          break;
      }
    }

    this.undoStack.push(entry);
    this.emit('redone', entry);
    return entry;
  }

  getUndoStack(): UndoEntry[] {
    return [...this.undoStack];
  }

  getRedoStack(): UndoEntry[] {
    return [...this.redoStack];
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clearHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.currentEntry = null;
    this.emit('historyCleared');
  }

  getHistoryForSession(sessionId: string): UndoEntry[] {
    return this.undoStack.filter(e => e.sessionId === sessionId);
  }

  async getGitHistory(limit: number = 20): Promise<Array<{ hash: string; message: string; date: string }>> {
    if (!await this.isGitRepo()) return [];

    try {
      const log = await this.execGit([
        'log',
        `--max-count=${limit}`,
        '--pretty=format:%H|%s|%ci',
      ]);

      return log.split('\n').filter(Boolean).map(line => {
        const [hash, message, date] = line.split('|');
        return { hash, message, date };
      });
    } catch {
      return [];
    }
  }

  async revertToCommit(commitHash: string): Promise<boolean> {
    if (!await this.isGitRepo()) return false;

    try {
      await this.execGit(['revert', '--no-commit', `${commitHash}..HEAD`]);
      await this.execGit(['commit', '-m', `[AIOS] Revert to ${commitHash.slice(0, 7)}`]);
      this.emit('revertedToCommit', commitHash);
      return true;
    } catch (err) {
      console.error('[GitUndoManager] Revert to commit failed:', err);
      return false;
    }
  }

  getStatus(): {
    undoCount: number;
    redoCount: number;
    hasActiveGroup: boolean;
    projectRoot: string;
  } {
    return {
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
      hasActiveGroup: this.currentEntry !== null,
      projectRoot: this.projectRoot,
    };
  }
}
