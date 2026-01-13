import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { GitWorktreeManager, type Worktree } from '../managers/GitWorktreeManager.js';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('GitWorktreeManager', () => {
  let manager: GitWorktreeManager;
  let testRepoPath: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    
    const tmpBase = os.tmpdir();
    const testId = Date.now();
    
    // Create a bare repository to act as origin
    const originRepoPath = path.join(tmpBase, `git-origin-${testId}`);
    fs.mkdirSync(originRepoPath, { recursive: true });
    execSync('git init --bare', { cwd: originRepoPath, stdio: 'pipe' });
    
    // Create local test repository
    testRepoPath = path.join(tmpBase, `git-local-${testId}`);
    fs.mkdirSync(testRepoPath, { recursive: true });
    
    // Initialize git repo
    execSync('git init', { cwd: testRepoPath, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: testRepoPath, stdio: 'pipe' });
    execSync('git config user.name "Test User"', { cwd: testRepoPath, stdio: 'pipe' });
    
    // Setup remote
    execSync(`git remote add origin "${originRepoPath.replace(/\\/g, '/')}"`, { cwd: testRepoPath, stdio: 'pipe' });
    
    // Create initial commit and push to main
    fs.writeFileSync(path.join(testRepoPath, 'README.md'), '# Test Repo');
    execSync('git add .', { cwd: testRepoPath, stdio: 'pipe' });
    execSync('git commit -m "Initial commit"', { cwd: testRepoPath, stdio: 'pipe' });
    execSync('git push -u origin HEAD:main', { cwd: testRepoPath, stdio: 'pipe' });
    
    manager = new GitWorktreeManager({ baseDir: testRepoPath, defaultBranch: 'main' });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    
    // Cleanup: remove all worktrees first, then the repo
    try {
      manager.cleanupAll();
    } catch {
      // Ignore cleanup errors
    }
    
    // Remove test directory
    try {
      fs.rmSync(testRepoPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Initialization', () => {
    test('should initialize with valid git repository', () => {
      expect(manager).toBeDefined();
    });
  });

  describe('Worktree Listing', () => {
    test('should list worktrees', async () => {
      const worktrees = manager.listWorktrees();
      expect(Array.isArray(worktrees)).toBe(true);
    });
  });

  describe('Worktree Creation', () => {
    test('should create a new worktree', async () => {
      const worktree = await manager.createWorktree('agent-1');
      
      expect(worktree).toBeDefined();
      expect(worktree.id).toBeDefined();
      expect(fs.existsSync(worktree.path)).toBe(true);
    });

    test('should throw error when max worktrees reached', async () => {
      const smallManager = new GitWorktreeManager({ baseDir: testRepoPath, maxWorktrees: 1 });
      await smallManager.createWorktree('agent-1');
      
      await expect(
        smallManager.createWorktree('agent-2')
      ).rejects.toThrow(/reached/i);
    });
  });

  describe('Worktree Operations', () => {
    let testWorktree: Worktree;

    beforeEach(async () => {
      testWorktree = await manager.createWorktree('ops-agent');
    });

    test('should get worktree by id', async () => {
      const worktree = manager.getWorktree(testWorktree.id);
      
      expect(worktree).toBeDefined();
      expect(worktree?.id).toBe(testWorktree.id);
    });

    test('should assign agent to worktree', async () => {
      const available = await manager.createWorktree();
      const assigned = manager.assignWorktree(available.id, 'new-agent');
      
      expect(assigned.agentId).toBe('new-agent');
      expect(assigned.status).toBe('in_use');
    });

    test('should release worktree', async () => {
      manager.releaseWorktree(testWorktree.id);
      
      const updated = manager.getWorktree(testWorktree.id);
      expect(updated?.agentId).toBeNull();
      expect(updated?.status).toBe('available');
    });
  });

  describe('Worktree Removal', () => {
    test('should remove worktree', async () => {
      const wt = await manager.createWorktree();
      const id = wt.id;

      await manager.removeWorktree(id);

      const retrieved = manager.getWorktree(id);
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Sync and Merge', () => {
    test('should sync worktree with main', async () => {
      const wt = await manager.createWorktree();
      // Sync should now work with the origin remote setup in beforeEach
      const result = await manager.syncWithMain(wt.id);
      expect(result.success).toBe(true);
    });

    test('should merge worktree to main', async () => {
      const wt = await manager.createWorktree('merger');
      
      // Create some changes
      fs.writeFileSync(path.join(wt.path, 'new-file.txt'), 'content');
      
      const result = await manager.mergeToMain(wt.id, 'Merge changes');
      expect(result.success).toBe(true);
    });
  });
});
