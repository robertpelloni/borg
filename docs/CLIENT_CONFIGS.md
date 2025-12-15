# Client Configuration Locations

This document serves as a reference for locating the MCP configuration files of various AI tools, IDEs, and CLIs. The "Super AI Plugin" aims to support auto-detection and configuration of these tools.

**Priority:** Windows configuration paths are prioritized, but Mac/Linux paths are included where available.

## IDEs & Editors

| Tool | Config Location (Windows) | Config Location (Mac/Linux) | Notes |
| :--- | :--- | :--- | :--- |
| **VSCode** | `%APPDATA%\Code\User\globalStorage\mcp-servers.json` | `~/Library/Application Support/Code/User/globalStorage/mcp-servers.json` | Also check specific plugin folders if config is plugin-specific. |
| **Cursor** | `%APPDATA%\Cursor\User\globalStorage\mcp-servers.json` | `~/Library/Application Support/Cursor/User/globalStorage/mcp-servers.json` | |
| **Windsurf** | `%APPDATA%\Windsurf\User\globalStorage\mcp-servers.json` | `~/Library/Application Support/Windsurf/User/globalStorage/mcp-servers.json` | |
| **Zed** | `%APPDATA%\Zed\settings.json` (Verify) | `~/.config/zed/settings.json` | Configuration likely embedded in main settings. |
| **Replit AI** | N/A (Web/Cloud) | N/A | Configuration likely via `.replit` file in project root. |
| **Trae** | `%APPDATA%\Trae\User\globalStorage\mcp.json` | `~/.config/trae/mcp.json` | |
| **PearAI** | `%APPDATA%\PearAI\User\globalStorage\mcp.json` | `~/.config/pearai/mcp.json` | |
| **Aide** | `%APPDATA%\Aide\User\config.json` | `~/.config/aide/config.json` | |
| **Melty** | `%APPDATA%\Melty\config.json` | `~/.config/melty/config.json` | |

## CLIs

| Tool | Config Location (Windows) | Config Location (Mac/Linux) | Notes |
| :--- | :--- | :--- | :--- |
| **Claude Code** | `%APPDATA%\Claude\claude.json` | `~/.claude.json` or `~/.config/claude-code/config.json` | |
| **Aider** | `.aider.conf.yml` (Project) or `%USERPROFILE%\.aider.conf.yml` | `~/.aider.conf.yml` | |
| **Open Interpreter** | `%APPDATA%\OpenInterpreter\config.yaml` | `~/.config/OpenInterpreter/config.yaml` | |
| **Gemini CLI** | `%USERPROFILE%\.gemini\config.json` | `~/.gemini/config.json` | |
| **Grok CLI** | `%USERPROFILE%\.grok\config.json` | `~/.grok/config.json` | |
| **Ollama CLI** | Environment Variables | Environment Variables | Config often via `OLLAMA_HOST`. |
| **Goose CLI** | `%APPDATA%\Goose\config.yaml` | `~/.config/goose/config.yaml` | |
| **Amazon Q** | `%USERPROFILE%\.aws\q\config.json` | `~/.aws/q/config.json` | |

## Desktop Apps

| Tool | Config Location (Windows) | Config Location (Mac/Linux) | Notes |
| :--- | :--- | :--- | :--- |
| **Claude Desktop** | `%APPDATA%\Claude\claude_desktop_config.json` | `~/Library/Application Support/Claude/claude_desktop_config.json` | The standard reference implementation. |
| **Docker Desktop** | `%USERPROFILE%\.docker\config.json` | `~/.docker/config.json` | MCP support via extensions. |
| **LM Studio** | `%USERPROFILE%\.cache\lm-studio\config.json` | `~/.cache/lm-studio/config.json` | |
| **AnythingLLM** | `%APPDATA%\AnythingLLM\config.json` | `~/.config/AnythingLLM/config.json` | |

## IDE Plugins
*Note: Plugins usually store config within the host IDE's storage or a dedicated folder in the user's home directory.*

| Plugin | Host | Config Pattern |
| :--- | :--- | :--- |
| **Cline** | VSCode | `%APPDATA%\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json` |
| **Roo Code** | VSCode | `%APPDATA%\Code\User\globalStorage\roovet.vscode-roo-code\settings\mcp.json` |
| **Continue** | VSCode/JetBrains | `%USERPROFILE%\.continue\config.json` | Shared config across IDEs. |
| **Cody** | VSCode | `%APPDATA%\Code\User\globalStorage\sourcegraph.cody-ai\...` | |
| **Codeium** | VSCode | `%USERPROFILE%\.codeium\config.json` | |

## Reference
See `submodules/mcpenetes` for implementation details on detecting and configuring these clients programmatically.
