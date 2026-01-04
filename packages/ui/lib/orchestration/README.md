# Jules Orchestration Library

This directory contains utility functions and integrations ported from `antigravity-jules-orchestration` to enable multi-agent orchestration and debate features within the Jules UI.

## Integrations

- **Qwen (Alibaba):** `qwen.ts` - Integration with Alibaba's Qwen models for code generation and reasoning.

## Planned Integrations

The following modules are planned for porting:
- **Ollama:** Local LLM support.
- **RAG:** Retrieval Augmented Generation utilities.
- **Debate Manager:** Logic to coordinate multiple supervisor agents (Claude, GPT, Gemini, Qwen) to debate session plans.

## Usage

```typescript
import { qwenCompletion } from '@/lib/orchestration/qwen';

const result = await qwenCompletion({
  prompt: "Analyze this code...",
  apiKey: "sk-..."
});
```
