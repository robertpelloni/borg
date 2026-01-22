# Supervisor Plugin Development Guide

Borg allows extending the Supervisor Council with external plugins. This guide explains how to create, test, and register your own supervisor plugins.

## Plugin Architecture

A supervisor plugin is a JavaScript/TypeScript module that implements the `SupervisorPlugin` interface.

```typescript
interface SupervisorPlugin {
  id: string;          // Unique identifier
  name: string;        // Human-readable name
  version: string;     // SemVer version
  description?: string;
  author?: string;
  specialties?: string[]; // Areas of expertise (e.g., 'security', 'frontend')
  
  // The core logic of the supervisor
  evaluate: (task: Task, context: Context) => Promise<EvaluationResult>;
  
  // Lifecycle hooks
  onLoad?: () => Promise<void>;
  onUnload?: () => Promise<void>;
}

interface EvaluationResult {
  vote: 'approve' | 'reject' | 'abstain' | 'error';
  confidence: number; // 0.0 to 1.0
  reasoning: string;  // Detailed explanation of the vote
}
```

## Creating a Plugin

### 1. Basic Implementation

Create a directory for your plugin and an `index.js` file:

```javascript
// my-supervisor/index.js
module.exports = {
  id: 'performance-expert',
  name: 'Performance Expert Supervisor',
  version: '1.0.0',
  specialties: ['performance', 'optimization'],
  
  evaluate: async (task, context) => {
    const hasPerformanceConcerns = task.description.toLowerCase().includes('loop') || 
                                  task.description.toLowerCase().includes('recursion');
                                  
    if (hasPerformanceConcerns) {
      return {
        vote: 'reject',
        confidence: 0.8,
        reasoning: 'Potential performance issue detected in the proposed logic.'
      };
    }
    
    return {
      vote: 'approve',
      confidence: 0.9,
      reasoning: 'No obvious performance bottlenecks found.'
    };
  }
};
```

### 2. Manifest File

Create a `manifest.json` in the same directory:

```json
{
  "id": "performance-expert",
  "name": "Performance Expert Supervisor",
  "version": "1.0.0",
  "main": "index.js",
  "description": "Specializes in identifying performance bottlenecks.",
  "specialties": ["performance", "optimization"]
}
```

## Registering Plugins

### Via Directory Loading

Borg Hub scans the `plugins/supervisors` directory on startup. Simply place your plugin folder there.

### Via API

You can register plugins dynamically via the REST API:

`POST /api/supervisor-plugins/register`
```json
{
  "plugin": {
    "id": "inline-plugin",
    "name": "Dynamic Supervisor",
    "version": "1.0.0",
    "evaluate": "async (task) => ({ vote: 'approve', confidence: 1, reasoning: 'OK' })"
  }
}
```

## Best Practices

1. **Be Specific**: Give your supervisor a clear specialty. General supervisors are less effective than specialists.
2. **Confidence Matters**: If the supervisor is unsure, lower the confidence score. Rejections with high confidence will block auto-approvals.
3. **Provide Reasoning**: Always provide detailed reasoning. This is shown in the Council Debate dashboard and helps developers understand the decision.
4. **Handle Errors**: Use try/catch blocks within the `evaluate` function to avoid crashing the council.

## Testing Your Plugin

Use the `SupervisorPluginManager` directly in your test suite:

```typescript
import { SupervisorPluginManager } from '../managers/SupervisorPluginManager';

const manager = new SupervisorPluginManager();
await manager.registerPlugin(myPlugin);

const result = await manager.evaluateWithPlugin('my-plugin', {
  description: 'Test task',
  files: []
});
```
