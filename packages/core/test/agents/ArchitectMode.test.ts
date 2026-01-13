import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { ArchitectMode, type ArchitectSession, type EditPlan } from '../agents/ArchitectMode.js';

// Mock the model chat function
const mockChatFn = mock(async (model: string, messages: any[]) => {
  const systemMessage = messages.find(m => m.role === 'system')?.content || '';
  const userMessage = messages.find(m => m.role === 'user')?.content || '';
  
  if (systemMessage.includes('edit plan') || userMessage.toLowerCase().includes('create the edit plan as json')) {
    return JSON.stringify({
      description: 'Implementation plan',
      estimatedComplexity: 'medium',
      files: [
        { path: 'src/file1.ts', action: 'modify', reasoning: 'Update logic' },
        { path: 'src/file2.ts', action: 'modify', reasoning: 'Update styles' }
      ],
      steps: ['Step 1', 'Step 2'],
      risks: ['Risk A']
    });
  }
  
  if (systemMessage.includes('code editor')) {
    return '// Edited code content';
  }
  
  return 'Architectural analysis and reasoning output.';
});

describe('ArchitectMode', () => {
  let architect: ArchitectMode;

  beforeEach(() => {
    architect = new ArchitectMode({
      reasoningModel: 'o3-mini',
      editingModel: 'gpt-4o',
    });
    architect.setChatFunction(mockChatFn as any);
    // Silence error events to prevent unhandled rejections during intentional failures
    architect.on('error', () => {});
    mockChatFn.mockClear();
  });

  describe('Session Management', () => {
    test('should start a new session', async () => {
      const session = await architect.startSession('Implement auth');
      
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.task).toBe('Implement auth');
      expect(session.status).toBe('reviewing');
    });

    test('should get session by ID', async () => {
      const created = await architect.startSession('Test task');
      const retrieved = architect.getSession(created.id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    test('should list all sessions', async () => {
      await architect.startSession('Task 1');
      await architect.startSession('Task 2');
      
      const sessions = architect.listSessions();
      expect(sessions.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Reasoning and Planning', () => {
    test('should invoke chat function for reasoning and planning', async () => {
      await architect.startSession('Complex feature');
      
      expect(mockChatFn).toHaveBeenCalled();
    });

    test('should emit lifecycle events', async () => {
      const events: string[] = [];
      architect.on('sessionStarted', () => events.push('started'));
      architect.on('planCreated', () => events.push('planned'));
      
      await architect.startSession('Test task');
      
      expect(events).toContain('started');
      expect(events).toContain('planned');
    });

    test('should handle reasoning errors', async () => {
      mockChatFn.mockRejectedValueOnce(new Error('Model timeout'));
      
      const session = await architect.startSession('Will fail');
      expect(session.status).toBe('error');
    });
  });

  describe('Plan Approval and Execution', () => {
    test('should transition to editing after approval', async () => {
      const session = await architect.startSession('Test task');
      const approved = architect.approvePlan(session.id);
      
      expect(approved).toBe(true);
      expect(architect.getSession(session.id)?.status).toBe('editing');
    });

    test('should generate edits for planned files', async () => {
      const session = await architect.startSession('Multi-file task');
      
      // Reset mock to track edit calls
      mockChatFn.mockClear();
      mockChatFn.mockResolvedValue('// Edited code');
      
      await architect.executeEdits(session.id);
      
      const updated = architect.getSession(session.id);
      expect(updated?.status).toBe('complete');
      expect(updated?.editOutput).toContain('src/file1.ts');
      expect(updated?.editOutput).toContain('src/file2.ts');
    });

    test('should reject plan', async () => {
      const session = await architect.startSession('Test task');
      const rejected = architect.rejectPlan(session.id, 'Too risky');
      
      expect(rejected).toBe(true);
      expect(architect.getSession(session.id)?.status).toBe('complete');
    });

    test('should revise plan with feedback', async () => {
      const session = await architect.startSession('Test task');
      
      // Ensure we clear previous calls to mockChatFn
      mockChatFn.mockClear();
      
      const revised = await architect.revisePlan(session.id, 'Use different pattern');
      
      const updatedSession = architect.getSession(session.id);
      if (updatedSession?.status === 'error') {
        console.error('Revision failed error:', updatedSession.reasoningOutput);
      }
      
      expect(revised).toBeDefined();
      expect(updatedSession?.status).toBe('reviewing');
    });
  });
});
