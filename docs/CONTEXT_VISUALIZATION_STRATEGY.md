# Context Visualization Strategy

## Objective
Provide users with transparency into what information is being sent to the LLM. This builds trust, helps debug prompts, and allows users to optimize context usage.

## Components

### 1. Context Analyzer (Backend)
Located in `packages/core/src/utils/ContextAnalyzer.ts`.
- **Function:** Intercepts the final prompt/context before it is sent to the LLM provider.
- **Analysis:**
  - **Token Count:** Estimates token usage per section.
  - **Attribution:** Tags content with its source (e.g., "File: src/app/page.tsx", "Memory: User Preferences", "Conversation History").
  - **Composition:** Calculates percentage breakdown (e.g., 40% Code, 10% System Prompt, 50% Conversation).

### 2. Context Inspector (UI)
Located at `/context` in the frontend (`packages/ui/src/app/context/page.tsx`).
- **Visualizer:** A stacked bar chart or treemap showing context composition.
- **Raw Viewer:** A collapsible text view showing the exact string being sent (with PII redaction options).
- **Source Map:** A list of all files and memories currently in context, allowing users to "eject" irrelevant items manually.

## Implementation Plan

1.  **Backend:**
    -   Create `ContextAnalyzer` class.
    -   Hook into `AgentExecutor` or `HubServer` to capture the context payload.
    -   Expose an API endpoint `GET /api/context/current` and `GET /api/context/stats`.

2.  **Frontend:**
    -   Build the `ContextPage` component.
    -   Use `recharts` for the composition chart.
    -   Use `monaco-editor` (read-only) for the raw viewer.

## Data Structure

```typescript
interface ContextLayer {
  id: string;
  type: 'system' | 'user' | 'assistant' | 'tool' | 'memory' | 'file';
  source: string; // Filename, Tool Name, or "User Input"
  content: string; // The actual text
  tokenCount: number;
  percentage: number;
}

interface ContextSnapshot {
  timestamp: number;
  totalTokens: number;
  layers: ContextLayer[];
}
```
