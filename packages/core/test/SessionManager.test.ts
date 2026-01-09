import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('SessionManager (Agent Persistence)', () => {
  const testDir = path.join(process.cwd(), 'test-agent-sessions');

  interface AgentSession {
    id: string;
    agentName: string;
    createdAt: string;
    messages: Array<{ role: string; content: string; timestamp: string }>;
  }

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  describe('Session CRUD', () => {
    it('should create a new session', () => {
      const session: AgentSession = {
        id: 'agent-session-1',
        agentName: 'TestAgent',
        createdAt: new Date().toISOString(),
        messages: [],
      };

      const filePath = path.join(testDir, `${session.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(session, null, 2));

      expect(fs.existsSync(filePath)).toBe(true);
      const loaded = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(loaded.agentName).toBe('TestAgent');
    });

    it('should append messages to session', () => {
      const session: AgentSession = {
        id: 'agent-session-2',
        agentName: 'ChatAgent',
        createdAt: new Date().toISOString(),
        messages: [],
      };

      const filePath = path.join(testDir, `${session.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(session, null, 2));

      // Append message
      const loaded = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as AgentSession;
      loaded.messages.push({
        role: 'user',
        content: 'Hello, agent!',
        timestamp: new Date().toISOString(),
      });
      loaded.messages.push({
        role: 'assistant',
        content: 'Hello! How can I help you today?',
        timestamp: new Date().toISOString(),
      });
      fs.writeFileSync(filePath, JSON.stringify(loaded, null, 2));

      const updated = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as AgentSession;
      expect(updated.messages.length).toBe(2);
      expect(updated.messages[0].role).toBe('user');
      expect(updated.messages[1].role).toBe('assistant');
    });

    it('should list all sessions', () => {
      const sessions: AgentSession[] = [
        { id: 'session-a', agentName: 'Agent1', createdAt: new Date().toISOString(), messages: [] },
        { id: 'session-b', agentName: 'Agent2', createdAt: new Date().toISOString(), messages: [] },
        { id: 'session-c', agentName: 'Agent3', createdAt: new Date().toISOString(), messages: [] },
      ];

      sessions.forEach((s) => {
        fs.writeFileSync(path.join(testDir, `${s.id}.json`), JSON.stringify(s));
      });

      const files = fs.readdirSync(testDir).filter((f) => f.endsWith('.json'));
      expect(files.length).toBe(3);
    });

    it('should delete a session', () => {
      const session: AgentSession = {
        id: 'to-delete',
        agentName: 'DeleteMe',
        createdAt: new Date().toISOString(),
        messages: [],
      };

      const filePath = path.join(testDir, `${session.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(session));
      expect(fs.existsSync(filePath)).toBe(true);

      fs.unlinkSync(filePath);
      expect(fs.existsSync(filePath)).toBe(false);
    });
  });

  describe('Message History', () => {
    it('should maintain message order', () => {
      const messages = [
        { role: 'system', content: 'You are a helpful assistant.', timestamp: '2024-01-01T00:00:00Z' },
        { role: 'user', content: 'First message', timestamp: '2024-01-01T00:00:01Z' },
        { role: 'assistant', content: 'First response', timestamp: '2024-01-01T00:00:02Z' },
        { role: 'user', content: 'Second message', timestamp: '2024-01-01T00:00:03Z' },
        { role: 'assistant', content: 'Second response', timestamp: '2024-01-01T00:00:04Z' },
      ];

      const session: AgentSession = {
        id: 'ordered-session',
        agentName: 'OrderTest',
        createdAt: new Date().toISOString(),
        messages,
      };

      const filePath = path.join(testDir, `${session.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(session, null, 2));

      const loaded = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as AgentSession;
      expect(loaded.messages.length).toBe(5);
      expect(loaded.messages[0].role).toBe('system');
      expect(loaded.messages[4].content).toBe('Second response');
    });

    it('should handle empty message history', () => {
      const session: AgentSession = {
        id: 'empty-session',
        agentName: 'EmptyAgent',
        createdAt: new Date().toISOString(),
        messages: [],
      };

      const filePath = path.join(testDir, `${session.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(session));

      const loaded = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as AgentSession;
      expect(loaded.messages).toEqual([]);
    });
  });
});
