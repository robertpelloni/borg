/**
 * Council Routes - Multi-LLM council API endpoints for AIOS
 * Provides supervisor management, debate/voting, and consensus operations
 */

import { Hono } from 'hono';
import { SupervisorCouncilManager, type ConsensusMode, type DevelopmentTask, type CouncilConfig } from '../managers/SupervisorCouncilManager.js';
import type { SupervisorConfig } from '../supervisors/BaseSupervisor.js';

export function createCouncilRoutes(): Hono {
  const router = new Hono();
  const council = SupervisorCouncilManager.getInstance();

  router.get('/status', (c) => {
    return c.json(council.getStatus());
  });

  router.get('/config', (c) => {
    return c.json(council.getConfig());
  });

  router.post('/supervisors', async (c) => {
    const config: SupervisorConfig = await c.req.json();
    
    if (!config.name || !config.provider) {
      return c.json({ error: 'name and provider are required' }, 400);
    }

    try {
      const supervisor = council.addSupervisor(config);
      return c.json({ 
        status: 'added', 
        supervisor: { name: supervisor.name, provider: supervisor.provider }
      });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  router.get('/supervisors', async (c) => {
    const supervisors = council.getSupervisors();
    const available = await council.getAvailableSupervisors();
    const availableNames = new Set(available.map(s => s.name));

    return c.json({
      supervisors: supervisors.map(s => ({
        name: s.name,
        provider: s.provider,
        weight: council.getSupervisorWeight(s.name),
        available: availableNames.has(s.name),
      })),
    });
  });

  router.delete('/supervisors/:name', (c) => {
    const name = c.req.param('name');
    const removed = council.removeSupervisor(name);
    
    if (!removed) {
      return c.json({ error: 'Supervisor not found' }, 404);
    }
    
    return c.json({ status: 'removed', name });
  });

  router.put('/supervisors/:name/weight', async (c) => {
    const name = c.req.param('name');
    const { weight } = await c.req.json();
    
    if (typeof weight !== 'number') {
      return c.json({ error: 'weight must be a number' }, 400);
    }

    const supervisor = council.getSupervisor(name);
    if (!supervisor) {
      return c.json({ error: 'Supervisor not found' }, 404);
    }

    council.setSupervisorWeight(name, weight);
    return c.json({ status: 'updated', name, weight: council.getSupervisorWeight(name) });
  });

  router.put('/consensus-mode', async (c) => {
    const { mode } = await c.req.json();
    const validModes: ConsensusMode[] = [
      'simple-majority', 'supermajority', 'unanimous', 'weighted',
      'ceo-override', 'ceo-veto', 'hybrid-ceo-majority', 'ranked-choice'
    ];
    
    if (!validModes.includes(mode)) {
      return c.json({ error: `Invalid mode. Valid: ${validModes.join(', ')}` }, 400);
    }

    council.setConsensusMode(mode);
    return c.json({ status: 'updated', mode });
  });

  router.put('/lead-supervisor', async (c) => {
    const { name } = await c.req.json();
    
    if (name && !council.getSupervisor(name)) {
      return c.json({ error: 'Supervisor not found' }, 404);
    }

    council.setLeadSupervisor(name);
    return c.json({ status: 'updated', leadSupervisor: name });
  });

  router.put('/fallback-chain', async (c) => {
    const { supervisors } = await c.req.json();
    
    if (!Array.isArray(supervisors)) {
      return c.json({ error: 'supervisors must be an array' }, 400);
    }

    council.setFallbackChain(supervisors);
    return c.json({ status: 'updated', fallbackChain: council.getFallbackChain() });
  });

  router.put('/settings', async (c) => {
    const { debateRounds, consensusThreshold, weightedVoting, enabled } = await c.req.json();
    
    if (typeof debateRounds === 'number') {
      council.setDebateRounds(Math.max(1, Math.min(5, debateRounds)));
    }
    if (typeof consensusThreshold === 'number') {
      council.setConsensusThreshold(Math.max(0.1, Math.min(1.0, consensusThreshold)));
    }
    if (typeof weightedVoting === 'boolean') {
      council.setWeightedVoting(weightedVoting);
    }
    if (typeof enabled === 'boolean') {
      council.setEnabled(enabled);
    }

    return c.json({ status: 'updated', config: council.getConfig() });
  });

  router.post('/debate', async (c) => {
    const task: DevelopmentTask = await c.req.json();
    
    if (!task.id || !task.description) {
      return c.json({ error: 'id and description are required' }, 400);
    }

    if (!council.isEnabled()) {
      return c.json({ 
        approved: true, 
        reasoning: 'Council is disabled - auto-approving',
        votes: [],
        consensus: 1.0,
        weightedConsensus: 1.0,
        dissent: []
      });
    }

    try {
      const decision = await council.debate(task);
      return c.json(decision);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  router.post('/chat', async (c) => {
    const { messages } = await c.req.json();
    
    if (!Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: 'messages array is required' }, 400);
    }

    try {
      const result = await council.chatWithFallback(messages);
      
      if (!result) {
        return c.json({ error: 'No supervisors available' }, 503);
      }

      return c.json(result);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  router.post('/reset', (c) => {
    council.clearSupervisors();
    return c.json({ status: 'reset' });
  });

  return router;
}
