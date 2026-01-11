# Slash Commands Implementation Fix

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   ╔═══════════════════════════════════════════════════════════════════╗     │
│   ║                                                                   ║     │
│   ║    ███████╗██╗      █████╗ ███████╗██╗  ██╗                       ║     │
│   ║    ██╔════╝██║     ██╔══██╗██╔════╝██║  ██║                       ║     │
│   ║    ███████╗██║     ███████║███████╗███████║                       ║     │
│   ║    ╚════██║██║     ██╔══██║╚════██║██╔══██║                       ║     │
│   ║    ███████║███████╗██║  ██║███████║██║  ██║                       ║     │
│   ║    ╚══════╝╚══════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝                       ║     │
│   ║                                                                   ║     │
│   ║     ██████╗ ██████╗ ███╗   ███╗███╗   ███╗ █████╗ ███╗   ██╗     ║     │
│   ║    ██╔════╝██╔═══██╗████╗ ████║████╗ ████║██╔══██╗████╗  ██║     ║     │
│   ║    ██║     ██║   ██║██╔████╔██║██╔████╔██║███████║██╔██╗ ██║     ║     │
│   ║    ██║     ██║   ██║██║╚██╔╝██║██║╚██╔╝██║██╔══██║██║╚██╗██║     ║     │
│   ║    ╚██████╗╚██████╔╝██║ ╚═╝ ██║██║ ╚═╝ ██║██║  ██║██║ ╚████║     ║     │
│   ║     ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝     ║     │
│   ║                                                                   ║     │
│   ║    ██████╗ ███████╗                                               ║     │
│   ║    ██╔══██╗██╔════╝                                               ║     │
│   ║    ██║  ██║███████╗                                               ║     │
│   ║    ██║  ██║╚════██║                                               ║     │
│   ║    ██████╔╝███████║                                               ║     │
│   ║    ╚═════╝ ╚══════╝                                               ║     │
│   ║                                                                   ║     │
│   ╚═══════════════════════════════════════════════════════════════════╝     │
│                                                                             │
│   Fix guide for slash commands not executing in Next.js client              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## The Problem

Slash commands are detected and autocomplete works, but when submitted:

1. Custom commands (from config) don't call the `/session/{id}/command` API
2. Built-in commands (like `/new`, `/share`) don't execute their callbacks
3. Everything just gets sent as a regular prompt

## Root Cause

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CURRENT FLOW (BROKEN)                               │
│                                                                             │
│   User types: /review uncommitted                                           │
│                     │                                                       │
│                     ▼                                                       │
│   PromptInput.handleSubmit(parts)                                           │
│                     │                                                       │
│                     ▼                                                       │
│   SessionLayout.handleSubmit(parts)                                         │
│                     │                                                       │
│                     ▼                                                       │
│   useSendMessage.sendMessage(parts)                                         │
│                     │                                                       │
│                     ▼                                                       │
│   caller("session.promptAsync", { parts })  ← WRONG! Should be command      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

The `useSendMessage` hook doesn't check if the message is a slash command. It always calls `session.promptAsync`.

## The Fix

### Step 1: Update `useSendMessage` to Handle Commands

```typescript
// apps/web/src/react/use-send-message.ts

import { useCallback, useState, useRef, useEffect } from "react";
import type { Prompt } from "@/types/prompt";
import { convertToApiParts } from "@/lib/prompt-api";
import { useSessionStatus } from "./use-session-status";
import { useOpencode } from "./provider";
import { useCommands } from "./use-commands";

// ... existing interfaces ...

export function useSendMessage({
  sessionId,
  directory,
}: UseSendMessageOptions): UseSendMessageReturn {
  // ... existing state ...

  const { caller } = useOpencode();
  const { findCommand } = useCommands();

  // ... existing refs ...

  /**
   * Check if prompt is a slash command
   */
  const parseSlashCommand = useCallback(
    (
      parts: Prompt,
    ): {
      isCommand: boolean;
      commandName?: string;
      arguments?: string;
      type?: "builtin" | "custom";
    } => {
      // Get text content
      const text = parts
        .filter((p) => p.type === "text")
        .map((p) => p.content)
        .join("")
        .trim();

      // Check if starts with /
      if (!text.startsWith("/")) {
        return { isCommand: false };
      }

      // Parse command and arguments
      const [cmdPart, ...argParts] = text.split(" ");
      const commandName = cmdPart.slice(1); // Remove leading /
      const args = argParts.join(" ");

      // Find command in registry
      const command = findCommand(commandName);

      if (!command) {
        // Unknown command - treat as regular prompt
        return { isCommand: false };
      }

      return {
        isCommand: true,
        commandName,
        arguments: args,
        type: command.type,
      };
    },
    [findCommand],
  );

  /**
   * Process a single message - handles both prompts and commands
   */
  const processMessage = useCallback(
    async (parts: Prompt, model?: ModelSelection) => {
      const parsed = parseSlashCommand(parts);

      if (parsed.isCommand && parsed.type === "custom") {
        // Custom command - call session.command API
        await caller("session.command", {
          sessionId,
          command: parsed.commandName!,
          arguments: parsed.arguments || "",
          // model is optional for commands
        });
      } else if (parsed.isCommand && parsed.type === "builtin") {
        // Built-in command - these should be handled client-side
        // Don't send to server, just resolve
        // The actual execution happens in PromptInput or a command handler
        return;
      } else {
        // Regular prompt
        const apiParts = convertToApiParts(parts, directory || "");
        await caller("session.promptAsync", {
          sessionId,
          parts: apiParts,
          model: model
            ? {
                providerID: model.providerID,
                modelID: model.modelID,
              }
            : undefined,
        });
      }
    },
    [sessionId, directory, caller, parseSlashCommand],
  );

  // ... rest of hook unchanged ...
}
```

### Step 2: Add `session.command` to Router Caller

The caller needs to support the command endpoint. Check your router definition:

```typescript
// apps/web/src/react/router.ts (or wherever your caller is defined)

export const routes = {
  // ... existing routes ...

  "session.command": {
    input: z.object({
      sessionId: z.string(),
      command: z.string(),
      arguments: z.string(),
      agent: z.string().optional(),
      model: z.string().optional(),
    }),
    handler: async ({ input, ctx }) => {
      const response = await ctx.client.session.command({
        sessionID: input.sessionId,
        command: input.command,
        arguments: input.arguments,
        agent: input.agent,
        model: input.model,
      });
      return response.data;
    },
  },
};
```

### Step 3: Handle Built-in Commands

Built-in commands like `/new`, `/share`, `/compact` should execute client-side actions. Update `PromptInput` or create a command handler:

```typescript
// apps/web/src/react/use-command-handler.ts

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useOpencode } from "./provider";

export function useCommandHandler(sessionId: string) {
  const router = useRouter();
  const { caller } = useOpencode();

  const executeBuiltinCommand = useCallback(
    async (commandId: string, args?: string): Promise<boolean> => {
      switch (commandId) {
        case "session.new":
          router.push("/");
          return true;

        case "session.share":
          await caller("session.share", { sessionId });
          return true;

        case "session.compact":
          await caller("session.compact", { sessionId });
          return true;

        default:
          return false; // Unknown command
      }
    },
    [router, caller, sessionId],
  );

  return { executeBuiltinCommand };
}
```

### Step 4: Update PromptInput Submit Handler

```typescript
// apps/web/src/components/prompt/PromptInput.tsx

// Add to imports
import { useCommandHandler } from "@/react/use-command-handler"

// In component
export function PromptInput({ sessionId, onSubmit, ... }: PromptInputProps) {
  const { findCommand } = useCommands()
  const { executeBuiltinCommand } = useCommandHandler(sessionId || "")

  // ... existing code ...

  // Update the submit handler in handleKeyDown
  if (e.key === "Enter" && !e.shiftKey && !autocomplete.visible) {
    e.preventDefault()

    // Get text content
    const text = parts
      .filter(p => p.type === "text")
      .map(p => p.content)
      .join("")
      .trim()

    // Check for built-in command
    if (text.startsWith("/")) {
      const [cmdPart] = text.split(" ")
      const commandName = cmdPart.slice(1)
      const command = findCommand(commandName)

      if (command?.type === "builtin") {
        // Execute built-in command client-side
        const handled = await executeBuiltinCommand(command.id)
        if (handled) {
          reset()
          setHasContent(false)
          if (editorRef.current) {
            editorRef.current.innerHTML = ""
          }
          return
        }
      }
    }

    // Regular submit (prompts and custom commands)
    if (canSubmit && onSubmit) {
      onSubmit(parts)
      reset()
      setHasContent(false)
      if (editorRef.current) {
        editorRef.current.innerHTML = ""
      }
    }
  }
}
```

### Step 5: Load Custom Commands from API

Update `useCommands` to fetch custom commands from the server:

```typescript
// apps/web/src/react/use-commands.ts

import { useMemo, useCallback, useEffect, useState } from "react";
import type { SlashCommand } from "@/types/prompt";
import { useOpencode } from "./provider";

const BUILTIN_COMMANDS: SlashCommand[] = [
  // ... existing builtin commands ...
];

export function useCommands() {
  const { caller } = useOpencode();
  const [customCommands, setCustomCommands] = useState<SlashCommand[]>([]);

  // Fetch custom commands from API
  useEffect(() => {
    async function fetchCommands() {
      try {
        const response = await caller("command.list", {});
        const commands = response.map((cmd: any) => ({
          id: `custom.${cmd.name}`,
          trigger: cmd.name,
          title: cmd.name,
          description: cmd.description,
          type: "custom" as const,
        }));
        setCustomCommands(commands);
      } catch (error) {
        console.error("Failed to fetch commands:", error);
      }
    }

    fetchCommands();
  }, [caller]);

  const commands = useMemo(
    () => [...BUILTIN_COMMANDS, ...customCommands],
    [customCommands],
  );

  // ... rest unchanged ...
}
```

### Step 6: Add Command List Route

```typescript
// In your router definition

"command.list": {
  input: z.object({}),
  handler: async ({ ctx }) => {
    const response = await ctx.client.command.list()
    return response.data ?? []
  },
},
```

---

## Complete Flow After Fix

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FIXED FLOW                                          │
│                                                                             │
│   User types: /review uncommitted                                           │
│                     │                                                       │
│                     ▼                                                       │
│   PromptInput detects / at start                                            │
│                     │                                                       │
│                     ▼                                                       │
│   Shows command autocomplete                                                │
│                     │                                                       │
│                     ▼                                                       │
│   User selects or types Enter                                               │
│                     │                                                       │
│         ┌──────────┴──────────┐                                             │
│         ▼                     ▼                                             │
│   Built-in?              Custom?                                            │
│         │                     │                                             │
│         ▼                     ▼                                             │
│   executeBuiltinCommand   onSubmit(parts)                                   │
│   (client-side action)          │                                           │
│                                 ▼                                           │
│                    useSendMessage.sendMessage(parts)                        │
│                                 │                                           │
│                                 ▼                                           │
│                    parseSlashCommand(parts)                                 │
│                                 │                                           │
│                    ┌────────────┴────────────┐                              │
│                    ▼                         ▼                              │
│              isCommand?                 Regular prompt                      │
│                    │                         │                              │
│                    ▼                         ▼                              │
│   caller("session.command", {    caller("session.promptAsync", {            │
│     command: "review",             parts: [...]                             │
│     arguments: "uncommitted"     })                                         │
│   })                                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Reference

### POST /session/{sessionID}/command

Execute a custom slash command.

**Request:**

```json
{
  "command": "review",
  "arguments": "uncommitted",
  "agent": "build", // optional
  "model": "anthropic/claude-sonnet-4-20250514" // optional
}
```

**Response:**

```json
{
  "info": {
    /* AssistantMessage */
  },
  "parts": [
    /* Part[] */
  ]
}
```

### GET /command

List available custom commands.

**Response:**

```json
[
  {
    "name": "review",
    "description": "Review code changes",
    "template": "Review the following changes...",
    "agent": "reviewer",
    "subtask": false
  }
]
```

---

## Testing Checklist

- [ ] `/new` creates a new session (client-side navigation)
- [ ] `/share` shares the current session
- [ ] `/compact` triggers context compaction
- [ ] `/review` (custom) calls session.command API
- [ ] `/review uncommitted` passes arguments correctly
- [ ] Unknown `/foo` is sent as regular prompt
- [ ] Autocomplete shows both builtin and custom commands
- [ ] Commands from config are fetched on mount

---

## Files to Modify

1. `apps/web/src/react/use-send-message.ts` - Add command detection
2. `apps/web/src/react/use-commands.ts` - Fetch custom commands
3. `apps/web/src/react/use-command-handler.ts` - New file for builtin commands
4. `apps/web/src/react/router.ts` - Add session.command and command.list routes
5. `apps/web/src/components/prompt/PromptInput.tsx` - Handle builtin commands on submit
