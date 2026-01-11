# OpenCode Slash Commands & @ References Guide

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   ╔═══════════════════════════════════════════════════════════════════╗     │
│   ║                                                                   ║     │
│   ║     ██████╗ ██████╗ ███╗   ███╗███╗   ███╗ █████╗ ███╗   ██╗     ║     │
│   ║    ██╔════╝██╔═══██╗████╗ ████║████╗ ████║██╔══██╗████╗  ██║     ║     │
│   ║    ██║     ██║   ██║██╔████╔██║██╔████╔██║███████║██╔██╗ ██║     ║     │
│   ║    ██║     ██║   ██║██║╚██╔╝██║██║╚██╔╝██║██╔══██║██║╚██╗██║     ║     │
│   ║    ╚██████╗╚██████╔╝██║ ╚═╝ ██║██║ ╚═╝ ██║██║  ██║██║ ╚████║     ║     │
│   ║     ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝     ║     │
│   ║                                                                   ║     │
│   ║    ██████╗ ███████╗███████╗███████╗                              ║     │
│   ║    ██╔══██╗██╔════╝██╔════╝██╔════╝                              ║     │
│   ║    ██████╔╝█████╗  █████╗  ███████╗                              ║     │
│   ║    ██╔══██╗██╔══╝  ██╔══╝  ╚════██║                              ║     │
│   ║    ██║  ██║███████╗██║     ███████║                              ║     │
│   ║    ╚═╝  ╚═╝╚══════╝╚═╝     ╚══════╝                              ║     │
│   ║                                                                   ║     │
│   ╚═══════════════════════════════════════════════════════════════════╝     │
│                                                                             │
│   Complete guide to slash commands and @ references in OpenCode             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Slash Commands](#slash-commands)
3. [@ References](#-references)
4. [Input Parsing](#input-parsing)
5. [Autocomplete Implementation](#autocomplete-implementation)
6. [API Endpoints](#api-endpoints)
7. [Message Parts](#message-parts)
8. [React Implementation](#react-implementation)
9. [Complete Working Example](#complete-working-example)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INPUT                                     │
│                                                                             │
│   "Review @src/auth.ts and check /review uncommitted"                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT PARSING                                    │
│                                                                             │
│   1. Detect @ trigger → Show file autocomplete                              │
│   2. User selects file → Insert FilePart pill                               │
│   3. Detect / at start → Show command autocomplete                          │
│   4. Parse final input → Extract parts array                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│      SLASH COMMAND            │   │      REGULAR PROMPT           │
│                               │   │                               │
│  POST /session/{id}/command   │   │  POST /session/{id}/message   │
│  {                            │   │  {                            │
│    command: "review",         │   │    parts: [                   │
│    arguments: "uncommitted",  │   │      { type: "text", ... },   │
│    agent: "build",            │   │      { type: "file", ... },   │
│    model: "anthropic/..."     │   │    ],                         │
│  }                            │   │    agent: "build",            │
│                               │   │    model: { ... }             │
└───────────────────────────────┘   │  }                            │
                                    └───────────────────────────────┘
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SERVER RESOLUTION                                 │
│                                                                             │
│   1. FilePart with file:// URL → Read file content                          │
│   2. Create synthetic TextPart with file content                            │
│   3. AgentPart → Load agent configuration                                   │
│   4. Process with AI model                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Insight:** The client does lightweight parsing and creates typed parts. The server does heavy lifting - reading files, resolving agents, and creating synthetic content.

---

## Slash Commands

### Two Types of Commands

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   BUILT-IN COMMANDS                    CUSTOM COMMANDS                      │
│   ─────────────────                    ───────────────                      │
│   Registered client-side               Defined in config                    │
│   Execute via callbacks                Execute via API                      │
│   UI actions (dialogs, nav)            AI prompts with templates            │
│                                                                             │
│   Examples:                            Examples:                            │
│   /new     → Create session            /review → Review code changes        │
│   /share   → Share session             /init   → Create AGENTS.md           │
│   /compact → Compact context           /custom → User-defined               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Built-in Commands (Client-Side)

Built-in commands are registered in components and execute client-side callbacks:

```typescript
// From packages/app/src/context/command.tsx

interface CommandOption {
  id: string; // Unique identifier
  title: string; // Display name
  description?: string; // Help text
  category?: string; // Grouping in palette
  keybind?: string; // Keyboard shortcut (e.g., "mod+n")
  slash?: string; // Slash trigger (e.g., "new")
  suggested?: boolean; // Show in suggestions
  disabled?: boolean; // Temporarily disable
  onSelect?: (source?: "palette" | "keybind" | "slash") => void;
}

// Registration example
command.register(() => [
  {
    id: "session.new",
    title: "New Session",
    keybind: "mod+n",
    slash: "new",
    onSelect: (source) => {
      navigate("/"); // Navigate to home to create new session
    },
  },
  {
    id: "session.share",
    title: "Share Session",
    keybind: "mod+shift+s",
    slash: "share",
    onSelect: () => {
      sdk.client.session.share({ sessionID });
    },
  },
]);
```

### Custom Commands (Server-Side)

Custom commands are defined in config and execute via API:

```yaml
# .opencode/config.yml or opencode.config.ts
command:
  review:
    description: "Review code changes"
    template: |
      Review the following changes in the codebase.
      Focus on:
      - Code quality
      - Potential bugs
      - Security issues

      {git diff}
    agent: "reviewer" # Optional: use specific agent
    model: "anthropic/claude-sonnet-4-20250514" # Optional: use specific model
    subtask: true # Optional: run as subtask

  explain:
    description: "Explain code in detail"
    template: |
      Explain the following code in detail:
      @{args}
```

### Command Template Variables

Templates support these variables:

| Variable     | Description                          |
| ------------ | ------------------------------------ |
| `{args}`     | Arguments after command name         |
| `{git diff}` | Output of `git diff`                 |
| `@filename`  | File reference (resolved to content) |
| `@agent`     | Agent reference                      |

### API Endpoint: Execute Command

```
POST /session/{sessionID}/command
Content-Type: application/json
x-opencode-directory: /path/to/project

{
  "command": "review",
  "arguments": "uncommitted",
  "agent": "build",
  "model": "anthropic/claude-sonnet-4-20250514"
}
```

**Response:**

```typescript
{
  info: AssistantMessage;
  parts: Part[];
}
```

### API Endpoint: List Commands

```
GET /command
x-opencode-directory: /path/to/project
```

**Response:**

```typescript
[
  {
    name: "init",
    description: "create/update AGENTS.md",
    template: "...",
    subtask: false,
  },
  {
    name: "review",
    description: "review changes [commit|branch|pr]",
    template: "...",
    subtask: true,
  },
];
```

---

## @ References

### Reference Types

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   @src/app.ts           → File reference (reads file content)               │
│   @src/components/      → Directory reference (lists contents)              │
│   @src/app.ts:10-20     → File with line selection                          │
│   @reviewer             → Agent reference (loads agent config)              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### File References

When user types `@`, show autocomplete with files. Selected file becomes a `FilePart`:

```typescript
// Client-side representation (during editing)
interface FileAttachmentPart {
  type: "file";
  path: string; // Relative path: "src/app.ts"
  content: string; // Display text: "@src/app.ts"
  start: number; // Character offset in prompt
  end: number;
  selection?: {
    // Optional line range
    startLine: number;
    endLine: number;
  };
}

// API representation (when sending to server)
interface FilePart {
  id: string;
  type: "file";
  mime: string; // "text/plain" or "application/x-directory"
  filename?: string; // "app.ts"
  url: string; // "file:///abs/path/src/app.ts?start=10&end=20"
  source?: {
    type: "file" | "symbol";
    path: string; // Absolute path
    text: {
      value: string; // Display text: "@src/app.ts"
      start: number; // Character offset
      end: number;
    };
  };
}
```

### Agent References

Agent references load agent configuration:

```typescript
// Client-side
interface AgentAttachmentPart {
  type: "agent";
  name: string; // "reviewer"
  content: string; // "@reviewer"
  start: number;
  end: number;
}

// API representation
interface AgentPart {
  id: string;
  type: "agent";
  name: string;
  source?: {
    value: string; // "@reviewer"
    start: number;
    end: number;
  };
}
```

### Server-Side Resolution

The server resolves file references to actual content:

```typescript
// From packages/opencode/src/session/prompt.ts:734-770

// For file:// URLs, server reads the file and creates synthetic parts
async function resolveFilePart(part: FilePart): Promise<Part[]> {
  const filepath = fileURLToPath(part.url);
  const url = new URL(part.url);
  const startLine = url.searchParams.get("start");
  const endLine = url.searchParams.get("end");

  let content = await Bun.file(filepath).text();

  // Apply line selection if specified
  if (startLine && endLine) {
    const lines = content.split("\n");
    content = lines.slice(Number(startLine) - 1, Number(endLine)).join("\n");
  }

  // Return synthetic parts that the AI will see
  return [
    {
      type: "text",
      synthetic: true,
      text: `Called the Read tool with the following input: {"filePath":"${part.filename}"}`,
    },
    {
      type: "text",
      synthetic: true,
      text: content, // Actual file content
    },
    part, // Original FilePart for reference
  ];
}
```

**Key Insight:** The client sends a lightweight `FilePart` with a `file://` URL. The server reads the file and creates synthetic `TextPart`s with the content. The AI sees the file content as if it was read by a tool.

---

## Input Parsing

### Trigger Detection

```typescript
// Detect @ reference trigger
const atMatch = text.substring(0, cursorPosition).match(/@(\S*)$/);
if (atMatch) {
  // Show file autocomplete with query: atMatch[1]
  showAutocomplete("file", atMatch[1]);
}

// Detect / command trigger (only at start of input)
const slashMatch = text.match(/^\/(\S*)$/);
if (slashMatch) {
  // Show command autocomplete with query: slashMatch[1]
  showAutocomplete("command", slashMatch[1]);
}
```

### Parsing from DOM (contenteditable)

```typescript
// From packages/app/src/components/prompt-input.tsx:395-456

interface Prompt = (TextPart | FileAttachmentPart | ImageAttachmentPart)[];

function parseFromDOM(editorRef: HTMLDivElement): Prompt {
  const parts: Prompt = [];
  let position = 0;
  let buffer = "";

  const flushText = () => {
    const content = buffer.replace(/\r\n?/g, "\n");
    buffer = "";
    if (!content) return;
    parts.push({
      type: "text",
      content,
      start: position,
      end: position + content.length
    });
    position += content.length;
  };

  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      buffer += node.textContent ?? "";
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;

    // File pill element
    if (el.dataset.type === "file") {
      flushText();
      const content = el.textContent ?? "";
      parts.push({
        type: "file",
        path: el.dataset.path!,
        content,
        start: position,
        end: position + content.length,
      });
      position += content.length;
      return;
    }

    // Line break
    if (el.tagName === "BR") {
      buffer += "\n";
      return;
    }

    // Recurse into children
    for (const child of Array.from(el.childNodes)) {
      visit(child);
    }
  };

  Array.from(editorRef.childNodes).forEach((child, index, arr) => {
    const isBlock = child.nodeType === Node.ELEMENT_NODE &&
                    ["DIV", "P"].includes((child as HTMLElement).tagName);
    visit(child);
    if (isBlock && index < arr.length - 1) {
      buffer += "\n";
    }
  });

  flushText();

  if (parts.length === 0) {
    parts.push({ type: "text", content: "", start: 0, end: 0 });
  }

  return parts;
}
```

### Cursor Position Tracking

```typescript
function getCursorPosition(parent: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;

  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(parent);
  preCaretRange.setEnd(range.startContainer, range.startOffset);

  return preCaretRange.toString().length;
}

function setCursorPosition(parent: HTMLElement, position: number) {
  let remaining = position;
  let node = parent.firstChild;

  while (node) {
    const length = node.textContent?.length ?? 0;
    const isText = node.nodeType === Node.TEXT_NODE;
    const isFile =
      node.nodeType === Node.ELEMENT_NODE &&
      (node as HTMLElement).dataset.type === "file";

    if (isText && remaining <= length) {
      const range = document.createRange();
      const selection = window.getSelection();
      range.setStart(node, remaining);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }

    if (isFile && remaining <= length) {
      const range = document.createRange();
      const selection = window.getSelection();
      range.setStartAfter(node);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }

    remaining -= length;
    node = node.nextSibling;
  }
}
```

---

## Autocomplete Implementation

### File Search API

```
GET /find/file?query=src/app&dirs=true
x-opencode-directory: /path/to/project
```

**Response:** `string[]` - Array of matching file paths

```typescript
// Example response
["src/app.ts", "src/app/", "src/app/layout.tsx", "src/app/page.tsx"];
```

### Fuzzy Filtering

Use a fuzzy search library like `fuzzysort`:

```typescript
import fuzzysort from "fuzzysort";

function filterFiles(query: string, files: string[]): string[] {
  if (!query) return files.slice(0, 10);

  const results = fuzzysort.go(query, files, {
    limit: 10,
    threshold: -10000,
  });

  return results.map((r) => r.target);
}
```

### Autocomplete Component Pattern

```typescript
interface AutocompleteState {
  visible: boolean;
  type: "file" | "command" | null;
  query: string;
  items: string[];
  selectedIndex: number;
}

function useAutocomplete() {
  const [state, setState] = useState<AutocompleteState>({
    visible: false,
    type: null,
    query: "",
    items: [],
    selectedIndex: 0,
  });

  const show = (type: "file" | "command", query: string) => {
    setState((s) => ({ ...s, visible: true, type, query, selectedIndex: 0 }));
  };

  const hide = () => {
    setState((s) => ({ ...s, visible: false, type: null }));
  };

  const navigate = (direction: "up" | "down") => {
    setState((s) => ({
      ...s,
      selectedIndex:
        direction === "up"
          ? Math.max(0, s.selectedIndex - 1)
          : Math.min(s.items.length - 1, s.selectedIndex + 1),
    }));
  };

  const select = () => {
    const item = state.items[state.selectedIndex];
    if (item) {
      // Handle selection
    }
    hide();
  };

  return { state, show, hide, navigate, select };
}
```

---

## API Endpoints

### File Search

```
GET /find/file
```

| Parameter | Type              | Description                         |
| --------- | ----------------- | ----------------------------------- |
| `query`   | string            | Search query                        |
| `dirs`    | "true" \| "false" | Include directories (default: true) |

**Response:** `string[]`

### Symbol Search (Currently Disabled)

```
GET /find/symbol
```

| Parameter | Type   | Description           |
| --------- | ------ | --------------------- |
| `query`   | string | Symbol name to search |

**Response:** `Symbol[]` (currently returns `[]`)

### List Commands

```
GET /command
```

**Response:**

```typescript
interface Command {
  name: string;
  description?: string;
  agent?: string;
  model?: string;
  template: string;
  subtask?: boolean;
}
```

### Execute Command

```
POST /session/{sessionID}/command
```

**Body:**

```typescript
{
  command: string;      // Command name
  arguments: string;    // Arguments after command
  agent?: string;       // Agent to use
  model?: string;       // Model in "provider/model" format
  messageID?: string;   // Optional message ID
}
```

### Send Prompt

```
POST /session/{sessionID}/message
```

**Body:**

```typescript
{
  messageID?: string;
  model?: {
    providerID: string;
    modelID: string;
  };
  agent?: string;
  noReply?: boolean;
  tools?: Record<string, boolean>;
  system?: string;
  parts: (TextPartInput | FilePartInput | AgentPartInput | SubtaskPartInput)[];
}
```

---

## Message Parts

### Part Types

```typescript
// Text content
interface TextPartInput {
  id?: string;
  type: "text";
  text: string;
  synthetic?: boolean; // Auto-generated by server
  ignored?: boolean; // Excluded from AI context
  time?: { start: number; end?: number };
  metadata?: Record<string, unknown>;
}

// File attachment
interface FilePartInput {
  id?: string;
  type: "file";
  mime: string; // "text/plain", "application/x-directory", etc.
  filename?: string;
  url: string; // "file:///path" or "data:..." for images
  source?: {
    type: "file" | "symbol";
    path: string;
    text: { value: string; start: number; end: number };
    // For symbols:
    range?: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    name?: string;
    kind?: number;
  };
}

// Agent reference
interface AgentPartInput {
  id?: string;
  type: "agent";
  name: string;
  source?: { value: string; start: number; end: number };
}

// Subtask (for agent spawning)
interface SubtaskPartInput {
  id?: string;
  type: "subtask";
  prompt: string;
  description: string;
  agent: string;
  command?: string;
}
```

### Converting Client Parts to API Parts

```typescript
// From packages/app/src/components/prompt-input.tsx:756-778

function convertToApiParts(
  prompt: Prompt,
  directory: string,
): (TextPartInput | FilePartInput)[] {
  const toAbsolutePath = (path: string) =>
    path.startsWith("/") ? path : `${directory}/${path}`;

  const textContent = prompt
    .filter((p) => p.type === "text")
    .map((p) => p.content)
    .join("");

  const textPart: TextPartInput = {
    id: generateId("part"),
    type: "text",
    text: textContent,
  };

  const fileParts: FilePartInput[] = prompt
    .filter((p): p is FileAttachmentPart => p.type === "file")
    .map((attachment) => {
      const absolute = toAbsolutePath(attachment.path);
      const query = attachment.selection
        ? `?start=${attachment.selection.startLine}&end=${attachment.selection.endLine}`
        : "";

      return {
        id: generateId("part"),
        type: "file",
        mime: "text/plain",
        url: `file://${absolute}${query}`,
        filename: getFilename(attachment.path),
        source: {
          type: "file",
          text: {
            value: attachment.content,
            start: attachment.start,
            end: attachment.end,
          },
          path: absolute,
        },
      };
    });

  return [textPart, ...fileParts];
}
```

---

## React Implementation

### Types

```typescript
// types/prompt.ts

export interface TextPart {
  type: "text";
  content: string;
  start: number;
  end: number;
}

export interface FileAttachmentPart {
  type: "file";
  path: string;
  content: string; // Display text like "@src/app.ts"
  start: number;
  end: number;
  selection?: {
    startLine: number;
    endLine: number;
  };
}

export interface ImageAttachmentPart {
  type: "image";
  id: string;
  filename: string;
  mime: string;
  dataUrl: string;
}

export type PromptPart = TextPart | FileAttachmentPart | ImageAttachmentPart;
export type Prompt = PromptPart[];

export interface SlashCommand {
  id: string;
  trigger: string;
  title: string;
  description?: string;
  keybind?: string;
  type: "builtin" | "custom";
}
```

### Prompt Store

```typescript
// stores/prompt-store.ts
import { create } from "zustand";

interface PromptState {
  parts: Prompt;
  cursor: number;
  autocomplete: {
    visible: boolean;
    type: "file" | "command" | null;
    query: string;
    items: string[] | SlashCommand[];
    selectedIndex: number;
  };

  // Actions
  setParts: (parts: Prompt, cursor?: number) => void;
  insertFilePart: (
    path: string,
    atPosition: number,
    replaceLength: number,
  ) => void;
  showAutocomplete: (type: "file" | "command", query: string) => void;
  hideAutocomplete: () => void;
  setAutocompleteItems: (items: string[] | SlashCommand[]) => void;
  navigateAutocomplete: (direction: "up" | "down") => void;
  reset: () => void;
}

export const usePromptStore = create<PromptState>((set, get) => ({
  parts: [{ type: "text", content: "", start: 0, end: 0 }],
  cursor: 0,
  autocomplete: {
    visible: false,
    type: null,
    query: "",
    items: [],
    selectedIndex: 0,
  },

  setParts: (parts, cursor) =>
    set({
      parts,
      cursor: cursor ?? get().cursor,
    }),

  insertFilePart: (path, atPosition, replaceLength) => {
    const { parts } = get();
    const content = `@${path}`;

    // Find the text part containing the cursor
    let charCount = 0;
    const newParts: Prompt = [];

    for (const part of parts) {
      if (part.type !== "text") {
        newParts.push(part);
        charCount += part.content.length;
        continue;
      }

      const partStart = charCount;
      const partEnd = charCount + part.content.length;

      if (atPosition >= partStart && atPosition <= partEnd) {
        // This is the part to split
        const localPos = atPosition - partStart;
        const before = part.content.slice(0, localPos - replaceLength);
        const after = part.content.slice(localPos);

        if (before) {
          newParts.push({
            type: "text",
            content: before,
            start: partStart,
            end: partStart + before.length,
          });
        }

        newParts.push({
          type: "file",
          path,
          content,
          start: partStart + before.length,
          end: partStart + before.length + content.length,
        });

        if (after) {
          newParts.push({
            type: "text",
            content: " " + after,
            start: partStart + before.length + content.length,
            end: partStart + before.length + content.length + after.length + 1,
          });
        } else {
          newParts.push({
            type: "text",
            content: " ",
            start: partStart + before.length + content.length,
            end: partStart + before.length + content.length + 1,
          });
        }
      } else {
        newParts.push(part);
      }

      charCount = partEnd;
    }

    set({ parts: newParts });
  },

  showAutocomplete: (type, query) =>
    set({
      autocomplete: {
        visible: true,
        type,
        query,
        items: [],
        selectedIndex: 0,
      },
    }),

  hideAutocomplete: () =>
    set({
      autocomplete: {
        visible: false,
        type: null,
        query: "",
        items: [],
        selectedIndex: 0,
      },
    }),

  setAutocompleteItems: (items) =>
    set((state) => ({
      autocomplete: { ...state.autocomplete, items },
    })),

  navigateAutocomplete: (direction) =>
    set((state) => ({
      autocomplete: {
        ...state.autocomplete,
        selectedIndex:
          direction === "up"
            ? Math.max(0, state.autocomplete.selectedIndex - 1)
            : Math.min(
                state.autocomplete.items.length - 1,
                state.autocomplete.selectedIndex + 1,
              ),
      },
    })),

  reset: () =>
    set({
      parts: [{ type: "text", content: "", start: 0, end: 0 }],
      cursor: 0,
      autocomplete: {
        visible: false,
        type: null,
        query: "",
        items: [],
        selectedIndex: 0,
      },
    }),
}));
```

### Command Registry

```typescript
// hooks/useCommands.ts
import { useCallback, useMemo } from "react";
import { useOpencode } from "../providers/OpencodeProvider";

interface CommandOption {
  id: string;
  title: string;
  description?: string;
  keybind?: string;
  slash?: string;
  type: "builtin" | "custom";
  onSelect?: () => void;
}

export function useCommands() {
  const { directory, sync } = useOpencode();

  // Built-in commands
  const builtinCommands: CommandOption[] = useMemo(
    () => [
      {
        id: "session.new",
        title: "New Session",
        keybind: "mod+n",
        slash: "new",
        type: "builtin",
      },
      {
        id: "session.share",
        title: "Share Session",
        keybind: "mod+shift+s",
        slash: "share",
        type: "builtin",
      },
      {
        id: "session.compact",
        title: "Compact Context",
        slash: "compact",
        type: "builtin",
      },
    ],
    [],
  );

  // Custom commands from sync
  const customCommands: CommandOption[] = useMemo(() => {
    return (sync.commands ?? []).map((cmd) => ({
      id: `custom.${cmd.name}`,
      title: cmd.name,
      description: cmd.description,
      slash: cmd.name,
      type: "custom" as const,
    }));
  }, [sync.commands]);

  const allCommands = useMemo(
    () => [...customCommands, ...builtinCommands],
    [customCommands, builtinCommands],
  );

  const getSlashCommands = useCallback(() => {
    return allCommands.filter((cmd) => cmd.slash);
  }, [allCommands]);

  const findCommand = useCallback(
    (trigger: string) => {
      return allCommands.find((cmd) => cmd.slash === trigger);
    },
    [allCommands],
  );

  return {
    commands: allCommands,
    getSlashCommands,
    findCommand,
  };
}
```

### Prompt Input Component

```typescript
// components/PromptInput.tsx
'use client';

import { useRef, useCallback, useEffect } from 'react';
import { usePromptStore } from '../stores/prompt-store';
import { useCommands } from '../hooks/useCommands';
import { useOpencode } from '../providers/OpencodeProvider';
import { Autocomplete } from './Autocomplete';

export function PromptInput({ sessionId }: { sessionId?: string }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const { directory, sdk } = useOpencode();
  const { commands, findCommand } = useCommands();
  const store = usePromptStore();

  // Sync DOM to store
  const parseFromDOM = useCallback(() => {
    if (!editorRef.current) return;

    const parts: Prompt = [];
    let position = 0;
    let buffer = "";

    const flushText = () => {
      if (!buffer) return;
      parts.push({
        type: "text",
        content: buffer,
        start: position,
        end: position + buffer.length
      });
      position += buffer.length;
      buffer = "";
    };

    const visit = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        buffer += node.textContent ?? "";
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const el = node as HTMLElement;
      if (el.dataset.type === "file") {
        flushText();
        const content = el.textContent ?? "";
        parts.push({
          type: "file",
          path: el.dataset.path!,
          content,
          start: position,
          end: position + content.length,
        });
        position += content.length;
        return;
      }
      if (el.tagName === "BR") {
        buffer += "\n";
        return;
      }
      el.childNodes.forEach(visit);
    };

    editorRef.current.childNodes.forEach(visit);
    flushText();

    if (parts.length === 0) {
      parts.push({ type: "text", content: "", start: 0, end: 0 });
    }

    return parts;
  }, []);

  // Get cursor position
  const getCursorPosition = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editorRef.current) return 0;

    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(editorRef.current);
    preCaretRange.setEnd(range.startContainer, range.startOffset);

    return preCaretRange.toString().length;
  }, []);

  // Handle input changes
  const handleInput = useCallback(() => {
    const parts = parseFromDOM();
    if (!parts) return;

    const cursor = getCursorPosition();
    const text = parts.map(p => 'content' in p ? p.content : '').join('');

    // Check for @ trigger
    const textBeforeCursor = text.substring(0, cursor);
    const atMatch = textBeforeCursor.match(/@(\S*)$/);

    if (atMatch) {
      store.showAutocomplete("file", atMatch[1]);
      // Fetch files
      sdk.find.files({ query: atMatch[1], dirs: "true" })
        .then(res => store.setAutocompleteItems(res.data ?? []));
    }
    // Check for / trigger at start
    else if (text.match(/^\/(\S*)$/)) {
      const query = text.slice(1);
      store.showAutocomplete("command", query);
      const filtered = commands
        .filter(c => c.slash?.includes(query))
        .map(c => ({ ...c, trigger: c.slash! }));
      store.setAutocompleteItems(filtered);
    }
    else {
      store.hideAutocomplete();
    }

    store.setParts(parts, cursor);
  }, [parseFromDOM, getCursorPosition, store, sdk, commands]);

  // Handle file selection from autocomplete
  const handleFileSelect = useCallback((path: string) => {
    const cursor = getCursorPosition();
    const text = store.parts.map(p => 'content' in p ? p.content : '').join('');
    const textBeforeCursor = text.substring(0, cursor);
    const atMatch = textBeforeCursor.match(/@(\S*)$/);
    const replaceLength = atMatch ? atMatch[0].length : 0;

    store.insertFilePart(path, cursor, replaceLength);
    store.hideAutocomplete();

    // Update DOM
    requestAnimationFrame(() => {
      if (!editorRef.current) return;
      renderPartsToDOM(editorRef.current, store.parts);
    });
  }, [getCursorPosition, store]);

  // Handle command selection
  const handleCommandSelect = useCallback((cmd: SlashCommand) => {
    store.hideAutocomplete();

    if (cmd.type === "custom") {
      // Keep command in input for arguments
      const text = `/${cmd.trigger} `;
      store.setParts([{ type: "text", content: text, start: 0, end: text.length }]);
    } else {
      // Execute built-in command
      // ... handle built-in command
    }
  }, [store]);

  // Handle keyboard
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const { autocomplete } = store;

    if (autocomplete.visible) {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        store.navigateAutocomplete("up");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        store.navigateAutocomplete("down");
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = autocomplete.items[autocomplete.selectedIndex];
        if (autocomplete.type === "file" && typeof item === "string") {
          handleFileSelect(item);
        } else if (autocomplete.type === "command") {
          handleCommandSelect(item as SlashCommand);
        }
      } else if (e.key === "Escape") {
        store.hideAutocomplete();
      }
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [store, handleFileSelect, handleCommandSelect]);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    const text = store.parts.map(p => 'content' in p ? p.content : '').join('');
    if (!text.trim()) return;

    // Check for slash command
    if (text.startsWith("/")) {
      const [cmdName, ...args] = text.split(" ");
      const command = findCommand(cmdName.slice(1));

      if (command?.type === "custom") {
        await sdk.session.command({
          sessionID: sessionId!,
          command: cmdName.slice(1),
          arguments: args.join(" "),
          agent: "build",
        });
        store.reset();
        return;
      }
    }

    // Regular prompt
    const parts = convertToApiParts(store.parts, directory);
    await sdk.session.prompt({
      sessionID: sessionId!,
      parts,
      agent: "build",
      model: { providerID: "anthropic", modelID: "claude-sonnet-4-20250514" },
    });

    store.reset();
  }, [store, sessionId, sdk, directory, findCommand]);

  return (
    <div className="relative">
      {store.autocomplete.visible && (
        <Autocomplete
          type={store.autocomplete.type}
          items={store.autocomplete.items}
          selectedIndex={store.autocomplete.selectedIndex}
          onSelect={(item) => {
            if (store.autocomplete.type === "file") {
              handleFileSelect(item as string);
            } else {
              handleCommandSelect(item as SlashCommand);
            }
          }}
        />
      )}

      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        className="min-h-[100px] p-4 outline-none"
        style={{
          // Style file pills
          '--file-pill-color': 'var(--color-blue-500)',
        } as React.CSSProperties}
      />
    </div>
  );
}

// Render parts back to DOM
function renderPartsToDOM(editor: HTMLDivElement, parts: Prompt) {
  editor.innerHTML = "";

  for (const part of parts) {
    if (part.type === "text") {
      editor.appendChild(document.createTextNode(part.content));
    } else if (part.type === "file") {
      const pill = document.createElement("span");
      pill.textContent = part.content;
      pill.dataset.type = "file";
      pill.dataset.path = part.path;
      pill.contentEditable = "false";
      pill.className = "text-blue-500 cursor-default";
      editor.appendChild(pill);
    }
  }
}

// Convert client parts to API format
function convertToApiParts(parts: Prompt, directory: string) {
  const text = parts
    .filter(p => p.type === "text")
    .map(p => p.content)
    .join("");

  const textPart = {
    id: crypto.randomUUID(),
    type: "text" as const,
    text,
  };

  const fileParts = parts
    .filter((p): p is FileAttachmentPart => p.type === "file")
    .map(p => ({
      id: crypto.randomUUID(),
      type: "file" as const,
      mime: "text/plain",
      url: `file://${directory}/${p.path}`,
      filename: p.path.split("/").pop(),
      source: {
        type: "file" as const,
        path: `${directory}/${p.path}`,
        text: { value: p.content, start: p.start, end: p.end },
      },
    }));

  return [textPart, ...fileParts];
}
```

### Autocomplete Component

```typescript
// components/Autocomplete.tsx
import { FileIcon } from './FileIcon';

interface AutocompleteProps {
  type: "file" | "command" | null;
  items: (string | SlashCommand)[];
  selectedIndex: number;
  onSelect: (item: string | SlashCommand) => void;
}

export function Autocomplete({ type, items, selectedIndex, onSelect }: AutocompleteProps) {
  if (!type || items.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 max-h-80 overflow-auto bg-white dark:bg-gray-900 border rounded-lg shadow-lg">
      {type === "file" && (
        <ul>
          {(items as string[]).map((path, i) => (
            <li
              key={path}
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${
                i === selectedIndex ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
              onClick={() => onSelect(path)}
            >
              <FileIcon path={path} className="w-4 h-4" />
              <span className="text-gray-500">{getDirectory(path)}</span>
              <span className="font-medium">{getFilename(path)}</span>
            </li>
          ))}
        </ul>
      )}

      {type === "command" && (
        <ul>
          {(items as SlashCommand[]).map((cmd, i) => (
            <li
              key={cmd.id}
              className={`flex items-center justify-between px-3 py-2 cursor-pointer ${
                i === selectedIndex ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
              onClick={() => onSelect(cmd)}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">/{cmd.trigger}</span>
                {cmd.description && (
                  <span className="text-gray-500">{cmd.description}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {cmd.type === "custom" && (
                  <span className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                    custom
                  </span>
                )}
                {cmd.keybind && (
                  <span className="text-xs text-gray-400">{formatKeybind(cmd.keybind)}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function getDirectory(path: string) {
  const parts = path.split("/");
  return parts.slice(0, -1).join("/") + (parts.length > 1 ? "/" : "");
}

function getFilename(path: string) {
  return path.split("/").pop() ?? path;
}

function formatKeybind(keybind: string) {
  const isMac = navigator.platform.includes("Mac");
  return keybind
    .replace("mod", isMac ? "⌘" : "Ctrl")
    .replace("shift", isMac ? "⇧" : "Shift")
    .replace("alt", isMac ? "⌥" : "Alt")
    .replace("+", "");
}
```

---

## Complete Working Example

### File Structure

```
src/
├── components/
│   ├── PromptInput.tsx
│   ├── Autocomplete.tsx
│   └── FileIcon.tsx
├── hooks/
│   ├── useCommands.ts
│   └── useKeyboard.ts
├── stores/
│   └── prompt-store.ts
├── types/
│   └── prompt.ts
└── utils/
    └── path.ts
```

### Usage

```typescript
// app/session/[id]/page.tsx
import { PromptInput } from '@/components/PromptInput';
import { OpencodeProvider } from '@/providers/OpencodeProvider';

export default function SessionPage({ params }: { params: { id: string } }) {
  return (
    <OpencodeProvider
      url={process.env.NEXT_PUBLIC_OPENCODE_URL!}
      directory={process.env.NEXT_PUBLIC_OPENCODE_DIRECTORY!}
    >
      <div className="flex flex-col h-screen">
        <div className="flex-1 overflow-auto">
          {/* Messages */}
        </div>
        <div className="border-t p-4">
          <PromptInput sessionId={params.id} />
        </div>
      </div>
    </OpencodeProvider>
  );
}
```

---

## Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           IMPLEMENTATION CHECKLIST                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  INPUT PARSING                                                              │
│  ✓ Detect @ trigger with regex: /@(\S*)$/                                   │
│  ✓ Detect / trigger at start: /^\/(\S*)$/                                   │
│  ✓ Parse contenteditable DOM to parts array                                 │
│  ✓ Track cursor position for insertion                                      │
│                                                                             │
│  AUTOCOMPLETE                                                               │
│  ✓ File search via GET /find/file?query=...                                 │
│  ✓ Command list from config + built-ins                                     │
│  ✓ Fuzzy filtering with fuzzysort                                           │
│  ✓ Keyboard navigation (↑/↓/Enter/Esc)                                      │
│                                                                             │
│  PARTS                                                                      │
│  ✓ TextPart for regular text                                                │
│  ✓ FileAttachmentPart with path + display text                              │
│  ✓ Convert to API format with file:// URLs                                  │
│  ✓ Handle line selections with ?start=N&end=M                               │
│                                                                             │
│  COMMANDS                                                                   │
│  ✓ Built-in commands execute client-side                                    │
│  ✓ Custom commands via POST /session/{id}/command                           │
│  ✓ Parse command name and arguments                                         │
│                                                                             │
│  RENDERING                                                                  │
│  ✓ File pills as non-editable spans                                         │
│  ✓ Preserve cursor position on updates                                      │
│  ✓ Style pills distinctly (e.g., blue text)                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Gotchas:**

1. **Symbol search is disabled** - `/find/symbol` returns `[]`
2. **File URLs need absolute paths** - Convert relative to absolute before sending
3. **Line selections use query params** - `file:///path?start=10&end=20`
4. **Server creates synthetic parts** - File content becomes TextPart with `synthetic: true`
5. **Commands split by type** - Built-in = client callback, Custom = API call
