---
title: Group Chat
description: Coordinate multiple AI agents in a single conversation with a moderator AI.
icon: comments
---

Group Chat lets you coordinate multiple AI agents in a single conversation. A moderator AI orchestrates the discussion, routing questions to the right agents and synthesizing their responses.

![Group chat](./screenshots/group-chat.png)

## When to Use Group Chat

- **Cross-project questions**: "How does the frontend authentication relate to the backend API?"
- **Architecture discussions**: Get perspectives from agents with different codebase contexts
- **Comparative analysis**: "Compare the testing approach in these three repositories"
- **Knowledge synthesis**: Combine expertise from specialized agents
- **Cross-machine collaboration**: Coordinate agents running on different machines via [SSH Remote Execution](./ssh-remote-execution)

## How It Works

1. **Create a Group Chat** from the sidebar menu
2. **Add participants** by @mentioning agent names (e.g., `@Frontend`, `@Backend`)
3. **Send your question** - the moderator receives it first
4. **Moderator coordinates** - routes to relevant agents via @mentions
5. **Agents respond** - each agent works in their own project context
6. **Moderator synthesizes** - combines responses into a coherent answer

## The Moderator's Role

The moderator is an AI that controls the conversation flow:

- **Direct answers**: For simple questions, the moderator responds directly
- **Delegation**: For complex questions, @mentions the appropriate agents
- **Follow-up**: If agent responses are incomplete, keeps asking until satisfied
- **Synthesis**: Combines multiple agent perspectives into a final answer

The moderator won't return to you until your question is properly answered — it will keep going back to agents as many times as needed.

## Example Conversation

```
You: "How does @Maestro relate to @RunMaestro.ai?"

Moderator: "Let me gather information from both projects.
            @Maestro @RunMaestro.ai - please explain your role in the ecosystem."

[Agents work in parallel...]

Maestro: "I'm the core Electron desktop app for AI orchestration..."

RunMaestro.ai: "I'm the marketing website and leaderboard..."

Moderator: "Here's how they relate:
            - Maestro is the desktop app (the product)
            - RunMaestro.ai is the website (discovery and community)
            - They share theme definitions for visual consistency

            Next steps: Would you like details on any specific integration?"
```

## Remote Agents in Group Chat

Group Chat works seamlessly with [SSH Remote Execution](./ssh-remote-execution). You can mix local and remote agents in the same conversation:

![Group Chat with Remote Agents](./screenshots/group-chat-over-ssh.png)

**Supported configurations:**
- Local moderator with remote participants
- Remote moderator with local participants
- Any mix of local and remote agents
- Agents spread across multiple SSH hosts

Remote agents are identified by the **REMOTE** pill in the participant list. Each agent works in their own environment — the moderator coordinates across machines transparently.

**Use cases for remote Group Chat:**
- Compare implementations across development and production environments
- Get perspectives from agents with access to different servers
- Coordinate changes that span multiple machines
- Synthesize information from agents with different tool installations

## Tips for Effective Group Chats

- **Name agents descriptively** - Agent names appear in the chat, so "Frontend-React" is clearer than "Agent1"
- **Be specific in questions** - The more context you provide, the better the moderator can route
- **@mention explicitly** - You can direct questions to specific agents: "What does @Backend think?"
- **Let the moderator work** - It may take multiple rounds for complex questions
- **Mix local and remote** - Combine agents across machines for maximum coverage
