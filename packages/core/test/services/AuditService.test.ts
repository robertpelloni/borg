import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuditService } from '../../src/services/AuditService.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('AuditService', () => {
  let auditService: AuditService;
  let testLogDir: string;

  beforeEach(() => {
    testLogDir = path.join(os.tmpdir(), `audit-test-${Date.now()}`);
    fs.mkdirSync(testLogDir, { recursive: true });
    
    // @ts-expect-error - reset singleton for isolated testing
    AuditService.instance = undefined;
    
    auditService = AuditService.getInstance({ 
      logDir: testLogDir,
      retentionDays: 7
    });
  });

  afterEach(() => {
    auditService.dispose();
    
    try {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    } catch {
      /* ignore cleanup errors in test teardown */
    }
  });

  describe('logging', () => {
    it('should log basic events', () => {
      auditService.log({
        type: 'auth.login',
        actor: 'user@example.com',
        action: 'login',
        outcome: 'success'
      });
      
      auditService.flush();
      
      const files = fs.readdirSync(testLogDir);
      expect(files.length).toBeGreaterThan(0);
      
      const content = fs.readFileSync(path.join(testLogDir, files[0]), 'utf-8');
      const event = JSON.parse(content.trim());
      
      expect(event.type).toBe('auth.login');
      expect(event.actor).toBe('user@example.com');
      expect(event.outcome).toBe('success');
      expect(event.id).toMatch(/^audit_/);
      expect(event.timestamp).toBeDefined();
    });

    it('should log auth events with helper', () => {
      auditService.logAuth('admin@example.com', 'login', { ip: '192.168.1.1' });
      auditService.flush();
      
      const files = fs.readdirSync(testLogDir);
      const content = fs.readFileSync(path.join(testLogDir, files[0]), 'utf-8');
      const event = JSON.parse(content.trim());
      
      expect(event.type).toBe('auth.login');
      expect(event.metadata?.ip).toBe('192.168.1.1');
    });

    it('should log secret access events', () => {
      auditService.logSecretAccess('service-account', 'API_KEY', 'access');
      auditService.flush();
      
      const files = fs.readdirSync(testLogDir);
      const content = fs.readFileSync(path.join(testLogDir, files[0]), 'utf-8');
      const event = JSON.parse(content.trim());
      
      expect(event.type).toBe('secret.access');
      expect(event.resource).toBe('API_KEY');
    });

    it('should log tool execution events', () => {
      auditService.logToolExecution('agent-1', 'file_read', 'success', { path: '/etc/passwd' });
      auditService.flush();
      
      const files = fs.readdirSync(testLogDir);
      const content = fs.readFileSync(path.join(testLogDir, files[0]), 'utf-8');
      const event = JSON.parse(content.trim());
      
      expect(event.type).toBe('tool.execute');
      expect(event.resource).toBe('file_read');
      expect(event.outcome).toBe('success');
    });

    it('should log blocked tool events', () => {
      auditService.logToolExecution('agent-1', 'shell_exec', 'blocked', { reason: 'dangerous command' });
      auditService.flush();
      
      const files = fs.readdirSync(testLogDir);
      const content = fs.readFileSync(path.join(testLogDir, files[0]), 'utf-8');
      const event = JSON.parse(content.trim());
      
      expect(event.type).toBe('tool.blocked');
    });
  });

  describe('buffering', () => {
    it('should buffer events before flushing', () => {
      auditService.log({ type: 'auth.login', actor: 'user1', action: 'login', outcome: 'success' });
      auditService.log({ type: 'auth.login', actor: 'user2', action: 'login', outcome: 'success' });
      
      auditService.flush();
      
      const files = fs.readdirSync(testLogDir);
      const content = fs.readFileSync(path.join(testLogDir, files[0]), 'utf-8');
      const lines = content.trim().split('\n');
      
      expect(lines.length).toBe(2);
    });

    it('should auto-flush when buffer reaches 100 events', () => {
      for (let i = 0; i < 101; i++) {
        auditService.log({ type: 'auth.login', actor: `user${i}`, action: 'login', outcome: 'success' });
      }
      
      const files = fs.readdirSync(testLogDir);
      expect(files.length).toBeGreaterThan(0);
    });
  });

  describe('query', () => {
    it('should query events by type', async () => {
      auditService.log({ type: 'auth.login', actor: 'user1', action: 'login', outcome: 'success' });
      auditService.log({ type: 'auth.logout', actor: 'user1', action: 'logout', outcome: 'success' });
      auditService.log({ type: 'auth.login', actor: 'user2', action: 'login', outcome: 'success' });
      auditService.flush();
      
      const results = await auditService.query({ type: 'auth.login' });
      
      expect(results.length).toBe(2);
      expect(results.every(e => e.type === 'auth.login')).toBe(true);
    });

    it('should query events by actor', async () => {
      auditService.log({ type: 'auth.login', actor: 'user1', action: 'login', outcome: 'success' });
      auditService.log({ type: 'tool.execute', actor: 'user1', action: 'execute', outcome: 'success' });
      auditService.log({ type: 'auth.login', actor: 'user2', action: 'login', outcome: 'success' });
      auditService.flush();
      
      const results = await auditService.query({ actor: 'user1' });
      
      expect(results.length).toBe(2);
      expect(results.every(e => e.actor === 'user1')).toBe(true);
    });

    it('should limit query results', async () => {
      for (let i = 0; i < 20; i++) {
        auditService.log({ type: 'auth.login', actor: `user${i}`, action: 'login', outcome: 'success' });
      }
      auditService.flush();
      
      const results = await auditService.query({ limit: 5 });
      
      expect(results.length).toBe(5);
    });

    it('should query by time range', async () => {
      const now = Date.now();
      
      auditService.log({ type: 'auth.login', actor: 'user1', action: 'login', outcome: 'success' });
      auditService.flush();
      
      const results = await auditService.query({ 
        startTime: now - 1000,
        endTime: now + 1000
      });
      
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('events', () => {
    it('should emit event on log', () => {
      const handler = vi.fn();
      auditService.on('event', handler);
      
      auditService.log({ type: 'auth.login', actor: 'user1', action: 'login', outcome: 'success' });
      
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'auth.login',
        actor: 'user1'
      }));
    });
  });

  describe('cleanup', () => {
    it('should remove old log files', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);
      const oldFileName = `audit-${oldDate.toISOString().split('T')[0]}.jsonl`;
      fs.writeFileSync(path.join(testLogDir, oldFileName), '{}');
      
      const recentFileName = `audit-${new Date().toISOString().split('T')[0]}.jsonl`;
      fs.writeFileSync(path.join(testLogDir, recentFileName), '{}');
      
      const removed = await auditService.cleanup();
      
      expect(removed).toBeGreaterThanOrEqual(1);
      expect(fs.existsSync(path.join(testLogDir, oldFileName))).toBe(false);
      expect(fs.existsSync(path.join(testLogDir, recentFileName))).toBe(true);
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      const instance1 = AuditService.getInstance();
      const instance2 = AuditService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });
});
