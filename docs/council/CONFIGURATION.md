# Council Configuration

## Environment Variables

Set API keys for each provider you want to use:

```bash
# Required for respective providers
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export DEEPSEEK_API_KEY="sk-..."
export GEMINI_API_KEY="..."
export GROK_API_KEY="..."          # or XAI_API_KEY
export QWEN_API_KEY="..."
export KIMI_API_KEY="..."          # or MOONSHOT_API_KEY
```

## Provider Configuration

### OpenAI
- **Base URL:** `https://api.openai.com/v1`
- **Default Model:** `gpt-4o`
- **Auth:** Bearer token

### Anthropic
- **Base URL:** `https://api.anthropic.com/v1`
- **Default Model:** `claude-3-5-sonnet-20241022`
- **Auth:** `x-api-key` header + `anthropic-version: 2023-06-01`

### DeepSeek
- **Base URL:** `https://api.deepseek.com/v1`
- **Default Model:** `deepseek-chat`
- **Auth:** Bearer token (OpenAI-compatible)

### Google Gemini
- **Base URL:** `https://generativelanguage.googleapis.com/v1beta`
- **Default Model:** `gemini-pro`
- **Auth:** API key in URL param

### xAI (Grok)
- **Base URL:** `https://api.x.ai/v1`
- **Default Model:** `grok-beta`
- **Auth:** Bearer token (OpenAI-compatible)

### Qwen (Alibaba)
- **Base URL:** `https://dashscope.aliyuncs.com/compatible-mode/v1`
- **Default Model:** `qwen-turbo`
- **Auth:** Bearer token (OpenAI-compatible)

### Moonshot (Kimi)
- **Base URL:** `https://api.moonshot.cn/v1`
- **Default Model:** `moonshot-v1-8k`
- **Auth:** Bearer token (OpenAI-compatible)

## Supervisor Configuration

When adding a supervisor, you can specify:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique identifier |
| `provider` | string | Yes | Provider type |
| `model` | string | No | Model override (uses provider default) |
| `weight` | number | No | Voting weight (0.1-2.0, default 1.0) |
| `systemPrompt` | string | No | Custom system prompt |
| `apiKey` | string | No | Override env var API key |
| `baseUrl` | string | No | Custom API endpoint |

## Council Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `consensusMode` | string | `weighted` | Voting algorithm |
| `consensusThreshold` | number | `0.6` | Required score (0-1) |
| `debateRounds` | number | `2` | Max debate iterations |
| `leadSupervisor` | string | null | CEO supervisor name |
| `fallbackChain` | string[] | `[]` | Ordered fallback list |

## File-Based Configuration

You can also configure the council via `.borg/council.json`:

```json
{
  "consensusMode": "weighted",
  "consensusThreshold": 0.6,
  "debateRounds": 2,
  "supervisors": [
    {
      "name": "GPT-4o",
      "provider": "openai",
      "model": "gpt-4o",
      "weight": 1.5
    },
    {
      "name": "Claude",
      "provider": "anthropic",
      "weight": 1.0
    }
  ],
  "fallbackChain": ["Claude", "GPT-4o"]
}
```

## Custom Provider

For self-hosted or other OpenAI-compatible APIs:

```json
{
  "name": "Local LLaMA",
  "provider": "custom",
  "baseUrl": "http://localhost:8080/v1",
  "model": "llama-3-70b",
  "apiKey": "not-needed"
}
```

## Network Configuration

### Retry Settings
- **Max Retries:** 3
- **Base Delay:** 1000ms
- **Max Delay:** 10000ms
- **Backoff:** Exponential with jitter

### Timeouts
- **Request Timeout:** 30000ms
- **Debate Timeout:** 120000ms (per round)

## Security

- API keys are never logged or exposed via API
- Use environment variables, not hardcoded keys
- Consider using Borg SecretManager for key rotation
- Enable rate limiting for production deployments
