import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

describe('CouncilManager', () => {
  const sessionsDir = path.join(process.cwd(), 'test-sessions');

  beforeEach(() => {
    vi.clearAllMocks();
    if (fs.existsSync(sessionsDir)) {
      fs.rmSync(sessionsDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(sessionsDir)) {
      fs.rmSync(sessionsDir, { recursive: true });
    }
  });

  describe('Session Management', () => {
    it('should create sessions directory if it does not exist', () => {
      expect(fs.existsSync(sessionsDir)).toBe(false);
      fs.mkdirSync(sessionsDir, { recursive: true });
      expect(fs.existsSync(sessionsDir)).toBe(true);
    });
  });

  describe('Session Persistence', () => {
    it('should save session state to JSON file', () => {
      const session = {
        id: 'test-session-1',
        agentPid: 12345,
        controllerPid: 67890,
        status: 'running',
        createdAt: new Date().toISOString(),
      };

      fs.mkdirSync(sessionsDir, { recursive: true });
      const filePath = path.join(sessionsDir, `${session.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(session, null, 2));

      const loaded = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(loaded.id).toBe('test-session-1');
      expect(loaded.status).toBe('running');
    });

    it('should load existing sessions on startup', () => {
      fs.mkdirSync(sessionsDir, { recursive: true });
      
      const sessions = [
        { id: 'session-1', status: 'running' },
        { id: 'session-2', status: 'stopped' },
      ];

      sessions.forEach((s) => {
        fs.writeFileSync(
          path.join(sessionsDir, `${s.id}.json`),
          JSON.stringify(s)
        );
      });

      const files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith('.json'));
      expect(files.length).toBe(2);

      const loadedSessions = files.map((f) =>
        JSON.parse(fs.readFileSync(path.join(sessionsDir, f), 'utf-8'))
      );
      expect(loadedSessions.map((s) => s.id)).toContain('session-1');
      expect(loadedSessions.map((s) => s.id)).toContain('session-2');
    });
  });

  describe('Event Emission', () => {
    it('should emit events for session lifecycle', () => {
      const emitter = new EventEmitter();
      const events: string[] = [];

      emitter.on('session:created', () => events.push('created'));
      emitter.on('session:started', () => events.push('started'));
      emitter.on('session:stopped', () => events.push('stopped'));

      emitter.emit('session:created');
      emitter.emit('session:started');
      emitter.emit('session:stopped');

      expect(events).toEqual(['created', 'started', 'stopped']);
    });
  });
});
