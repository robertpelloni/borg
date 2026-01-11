package config

import (
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

// AgentConfig defines a single agent's configuration
type AgentConfig struct {
	Name        string   `yaml:"name"`
	Command     string   `yaml:"command"`
	Args        []string `yaml:"args,omitempty"`
	Dir         string   `yaml:"dir,omitempty"`
	Description string   `yaml:"description,omitempty"`
	Enabled     bool     `yaml:"enabled"`
}

// LLMConfig holds LLM provider configuration
type LLMConfig struct {
	Provider    string  `yaml:"provider"`              // "openai", "anthropic", "ollama"
	APIKey      string  `yaml:"api_key,omitempty"`     // API key (or use env var)
	APIKeyEnv   string  `yaml:"api_key_env,omitempty"` // Environment variable name for API key
	Model       string  `yaml:"model"`                 // Model name (e.g., "gpt-4o", "claude-3-opus")
	BaseURL     string  `yaml:"base_url,omitempty"`    // Custom API endpoint
	MaxTokens   int     `yaml:"max_tokens,omitempty"`
	Temperature float64 `yaml:"temperature,omitempty"`
}

// ProviderConfig holds configuration for a single LLM provider
type ProviderConfig struct {
	Type       string            `yaml:"type"`                  // "openai", "anthropic", "google", "ollama"
	Name       string            `yaml:"name"`                  // Display name
	APIKey     string            `yaml:"api_key,omitempty"`     // API key
	APIKeyEnv  string            `yaml:"api_key_env,omitempty"` // Env var for API key
	BaseURL    string            `yaml:"base_url,omitempty"`    // Custom API endpoint
	OrgID      string            `yaml:"org_id,omitempty"`      // Organization ID (OpenAI)
	ProjectID  string            `yaml:"project_id,omitempty"`  // Project ID (Google)
	Region     string            `yaml:"region,omitempty"`      // Region (AWS Bedrock, Azure)
	Enabled    bool              `yaml:"enabled"`
	Priority   int               `yaml:"priority"` // Higher = preferred
	Weight     int               `yaml:"weight"`   // For weighted routing
	MaxRetries int               `yaml:"max_retries,omitempty"`
	TimeoutSec int               `yaml:"timeout_secs,omitempty"`
	Headers    map[string]string `yaml:"headers,omitempty"`
	Models     []string          `yaml:"models,omitempty"` // Available models
}

// GetAPIKey returns the API key, checking env var if direct key not set
func (c *ProviderConfig) GetAPIKey() string {
	if c.APIKey != "" {
		return c.APIKey
	}
	if c.APIKeyEnv != "" {
		return os.Getenv(c.APIKeyEnv)
	}
	return ""
}

// ProvidersConfig holds all provider configurations
type ProvidersConfig struct {
	DefaultProvider string           `yaml:"default_provider,omitempty"`
	Providers       []ProviderConfig `yaml:"providers"`
	Routing         RoutingConfig    `yaml:"routing,omitempty"`
	ModelSelection  ModelSelConfig   `yaml:"model_selection,omitempty"`
}

// RoutingConfig holds routing strategy settings
type RoutingConfig struct {
	Strategy         string   `yaml:"strategy"` // "priority", "round_robin", "weighted", "least_load", "latency", "cost_optimal", "failover"
	MaxRetries       int      `yaml:"max_retries"`
	RetryDelayMs     int      `yaml:"retry_delay_ms"`
	CircuitBreaker   bool     `yaml:"circuit_breaker"`
	FailureThreshold int      `yaml:"failure_threshold"`
	RecoveryTimeSec  int      `yaml:"recovery_time_secs"`
	ExcludeProviders []string `yaml:"exclude_providers,omitempty"`
}

// ModelSelConfig holds model selection preferences
type ModelSelConfig struct {
	PreferLocal       bool     `yaml:"prefer_local"`
	PreferFast        bool     `yaml:"prefer_fast"`
	PreferCheap       bool     `yaml:"prefer_cheap"`
	PreferQuality     bool     `yaml:"prefer_quality"`
	MaxCostPerRequest float64  `yaml:"max_cost_per_request,omitempty"`
	MinContextWindow  int      `yaml:"min_context_window,omitempty"`
	ExcludeModels     []string `yaml:"exclude_models,omitempty"`
	FallbackModel     string   `yaml:"fallback_model,omitempty"`
}

// GetAPIKey returns the API key, checking env var if direct key not set
func (c *LLMConfig) GetAPIKey() string {
	if c.APIKey != "" {
		return c.APIKey
	}
	if c.APIKeyEnv != "" {
		return os.Getenv(c.APIKeyEnv)
	}
	return ""
}

// MCPHubConfig holds MCP hub connection settings
type MCPHubConfig struct {
	URL     string `yaml:"url"`
	Enabled bool   `yaml:"enabled"`
}

// MCPServerConfig defines a single MCP server configuration
type MCPServerConfig struct {
	Name        string            `yaml:"name"`
	Type        string            `yaml:"type"`                   // "stdio", "sse", "http"
	Command     string            `yaml:"command,omitempty"`      // For stdio transport
	Args        []string          `yaml:"args,omitempty"`         // For stdio transport
	URL         string            `yaml:"url,omitempty"`          // For SSE/HTTP transport
	Headers     map[string]string `yaml:"headers,omitempty"`      // HTTP headers
	Env         map[string]string `yaml:"env,omitempty"`          // Environment variables
	AutoApprove []string          `yaml:"auto_approve,omitempty"` // Tool patterns to auto-approve
	Description string            `yaml:"description,omitempty"`
	Enabled     bool              `yaml:"enabled"`
}

// AgentLoopConfig holds configuration for the Plan/Act/Verify agent loop
type AgentLoopConfig struct {
	Enabled          bool     `yaml:"enabled"`
	ApprovalMode     string   `yaml:"approval_mode"`   // "conservative", "balanced", "yolo"
	DefaultPersona   string   `yaml:"default_persona"` // "coder", "researcher", "reviewer", "architect", "debugger"
	MaxIterations    int      `yaml:"max_iterations"`
	MaxRetries       int      `yaml:"max_retries"`
	StepTimeoutSecs  int      `yaml:"step_timeout_secs"`
	AutoApproveTools []string `yaml:"auto_approve_tools,omitempty"`
	CheckpointEvery  int      `yaml:"checkpoint_every"`
	RulesDir         string   `yaml:"rules_dir,omitempty"` // Custom rules directory
}

// ContextConfig holds configuration for the context system
type ContextConfig struct {
	TokenBudget      int                   `yaml:"token_budget"`
	LayerBudgets     map[string]int        `yaml:"layer_budgets,omitempty"`
	EnableCompaction bool                  `yaml:"enable_compaction"`
	MaxItemsPerLayer int                   `yaml:"max_items_per_layer"`
	ExpandThreshold  float64               `yaml:"expand_threshold"`
	DefaultProviders []string              `yaml:"default_providers,omitempty"`
	CustomCommands   []CustomCommandConfig `yaml:"custom_commands,omitempty"`
	MemorySettings   MemoryConfig          `yaml:"memory,omitempty"`
}

// CustomCommandConfig defines a custom slash command
type CustomCommandConfig struct {
	Name        string `yaml:"name"`
	Description string `yaml:"description"`
	Usage       string `yaml:"usage"`
	Template    string `yaml:"template"`
	Enabled     bool   `yaml:"enabled"`
}

// MemoryConfig holds memory bank settings
type MemoryConfig struct {
	Enabled       bool   `yaml:"enabled"`
	BaseDir       string `yaml:"base_dir,omitempty"`
	AutoFlush     bool   `yaml:"auto_flush"`
	MaxEntries    int    `yaml:"max_entries"`
	RetentionDays int    `yaml:"retention_days"`
}

// PluginConfig holds plugin system configuration
type PluginConfig struct {
	Enabled         bool                   `yaml:"enabled"`
	PluginDir       string                 `yaml:"plugin_dir,omitempty"`
	HotReload       bool                   `yaml:"hot_reload"`
	WatchIntervalMs int                    `yaml:"watch_interval_ms"`
	Sandboxing      PluginSandboxConfig    `yaml:"sandboxing"`
	Lifecycle       PluginLifecycleConfig  `yaml:"lifecycle"`
	EventBus        PluginEventBusConfig   `yaml:"event_bus"`
	Plugins         []PluginInstanceConfig `yaml:"plugins,omitempty"`
}

// PluginSandboxConfig holds sandboxing settings for plugins
type PluginSandboxConfig struct {
	Enabled          bool     `yaml:"enabled"`
	MaxMemoryMB      int64    `yaml:"max_memory_mb"`
	MaxCPUPercent    float64  `yaml:"max_cpu_percent"`
	MaxGoroutines    int      `yaml:"max_goroutines"`
	MaxFileHandles   int      `yaml:"max_file_handles"`
	MaxNetConns      int      `yaml:"max_net_conns"`
	ExecutionTimeout int      `yaml:"execution_timeout_secs"`
	AllowedPaths     []string `yaml:"allowed_paths,omitempty"`
	DeniedPaths      []string `yaml:"denied_paths,omitempty"`
	AllowedHosts     []string `yaml:"allowed_hosts,omitempty"`
	DeniedHosts      []string `yaml:"denied_hosts,omitempty"`
	DefaultPerms     []string `yaml:"default_permissions,omitempty"`
	LogViolations    bool     `yaml:"log_violations"`
	TerminateOnLimit bool     `yaml:"terminate_on_limit"`
}

// PluginLifecycleConfig holds lifecycle management settings
type PluginLifecycleConfig struct {
	InitTimeoutSecs    int  `yaml:"init_timeout_secs"`
	StartTimeoutSecs   int  `yaml:"start_timeout_secs"`
	StopTimeoutSecs    int  `yaml:"stop_timeout_secs"`
	HealthIntervalSecs int  `yaml:"health_interval_secs"`
	HealthTimeoutSecs  int  `yaml:"health_timeout_secs"`
	MaxHealthFails     int  `yaml:"max_health_fails"`
	GracefulShutdown   bool `yaml:"graceful_shutdown"`
	RetryOnError       bool `yaml:"retry_on_error"`
	MaxRetries         int  `yaml:"max_retries"`
}

// PluginEventBusConfig holds event bus settings
type PluginEventBusConfig struct {
	BufferSize int `yaml:"buffer_size"`
	Workers    int `yaml:"workers"`
}

// PluginInstanceConfig defines a specific plugin instance configuration
type PluginInstanceConfig struct {
	Name         string         `yaml:"name"`
	Path         string         `yaml:"path,omitempty"`
	Source       string         `yaml:"source,omitempty"` // "local", "marketplace", "git"
	Version      string         `yaml:"version,omitempty"`
	Enabled      bool           `yaml:"enabled"`
	AutoStart    bool           `yaml:"auto_start"`
	Priority     int            `yaml:"priority"`
	Config       map[string]any `yaml:"config,omitempty"`
	Permissions  []string       `yaml:"permissions,omitempty"`
	Dependencies []string       `yaml:"dependencies,omitempty"`
}

// Config holds all SuperAI CLI configuration
type Config struct {
	Version    string            `yaml:"version"`
	Agents     []AgentConfig     `yaml:"agents"`
	MCPHub     MCPHubConfig      `yaml:"mcp_hub"`
	MCPServers []MCPServerConfig `yaml:"mcp_servers,omitempty"`
	LLM        LLMConfig         `yaml:"llm"`
	Providers  ProvidersConfig   `yaml:"providers,omitempty"`
	AgentLoop  AgentLoopConfig   `yaml:"agent_loop"`
	Context    ContextConfig     `yaml:"context,omitempty"`
	Plugin     PluginConfig      `yaml:"plugin,omitempty"`
}

// DefaultConfig returns a default configuration with common agents
func DefaultConfig() *Config {
	homeDir, _ := os.UserHomeDir()
	submodulesDir := filepath.Join(homeDir, "workspace", "aios", "submodules")

	return &Config{
		Version: "2.0.0",
		Agents: []AgentConfig{
			{
				Name:        "aichat",
				Command:     "aichat",
				Args:        []string{},
				Description: "All-in-one LLM CLI (Rust) - REPL, shell assistant, RAG, agents",
				Enabled:     true,
			},
			{
				Name:        "vibe-kanban",
				Command:     "npx",
				Args:        []string{"vibe-kanban"},
				Description: "Kanban board for AI coding agents - orchestrates claude-code, gemini-cli, codex",
				Enabled:     true,
			},
			{
				Name:        "opencode",
				Command:     "opencode",
				Args:        []string{},
				Description: "OpenCode AI coding assistant",
				Enabled:     true,
			},
			{
				Name:        "claude-code",
				Command:     "claude",
				Args:        []string{},
				Description: "Anthropic Claude CLI for coding",
				Enabled:     true,
			},
			{
				Name:        "plandex",
				Command:     "plandex",
				Args:        []string{},
				Description: "AI coding agent with planning capabilities",
				Enabled:     true,
			},
			{
				Name:        "aider",
				Command:     "aider",
				Args:        []string{},
				Description: "AI pair programming in your terminal",
				Enabled:     true,
			},
			{
				Name:        "mcp-cli",
				Command:     "mcp",
				Args:        []string{},
				Dir:         filepath.Join(submodulesDir, "mcp-cli"),
				Description: "MCP command line interface",
				Enabled:     false,
			},
		},
		MCPHub: MCPHubConfig{
			URL:     "http://localhost:3000",
			Enabled: true,
		},
		MCPServers: []MCPServerConfig{
			{
				Name:        "filesystem",
				Type:        "stdio",
				Command:     "npx",
				Args:        []string{"-y", "@modelcontextprotocol/server-filesystem", homeDir},
				Description: "File system access via MCP",
				AutoApprove: []string{"read_*", "list_*"},
				Enabled:     false,
			},
			{
				Name:        "github",
				Type:        "stdio",
				Command:     "npx",
				Args:        []string{"-y", "@modelcontextprotocol/server-github"},
				Env:         map[string]string{"GITHUB_PERSONAL_ACCESS_TOKEN": ""},
				Description: "GitHub API access via MCP",
				Enabled:     false,
			},
			{
				Name:        "memory",
				Type:        "stdio",
				Command:     "npx",
				Args:        []string{"-y", "@modelcontextprotocol/server-memory"},
				Description: "Knowledge graph memory via MCP",
				AutoApprove: []string{"*"},
				Enabled:     false,
			},
			{
				Name:        "brave-search",
				Type:        "stdio",
				Command:     "npx",
				Args:        []string{"-y", "@modelcontextprotocol/server-brave-search"},
				Env:         map[string]string{"BRAVE_API_KEY": ""},
				Description: "Brave Search API via MCP",
				Enabled:     false,
			},
			{
				Name:        "puppeteer",
				Type:        "stdio",
				Command:     "npx",
				Args:        []string{"-y", "@modelcontextprotocol/server-puppeteer"},
				Description: "Browser automation via Puppeteer MCP",
				Enabled:     false,
			},
		},
		LLM: LLMConfig{
			Provider:    "openai",
			APIKeyEnv:   "OPENAI_API_KEY",
			Model:       "gpt-4o",
			MaxTokens:   4096,
			Temperature: 0.7,
		},
		AgentLoop: AgentLoopConfig{
			Enabled:          false,
			ApprovalMode:     "balanced",
			DefaultPersona:   "coder",
			MaxIterations:    10,
			MaxRetries:       3,
			StepTimeoutSecs:  300,
			AutoApproveTools: []string{"read_file", "list_files", "search", "grep"},
			CheckpointEvery:  5,
		},
		Context: ContextConfig{
			TokenBudget:      100000,
			EnableCompaction: true,
			MaxItemsPerLayer: 50,
			ExpandThreshold:  0.8,
			LayerBudgets: map[string]int{
				"system":  10000,
				"project": 30000,
				"task":    40000,
				"history": 15000,
				"user":    5000,
			},
			DefaultProviders: []string{"file", "diff", "folder"},
			MemorySettings: MemoryConfig{
				Enabled:       true,
				AutoFlush:     true,
				MaxEntries:    1000,
				RetentionDays: 90,
			},
		},
		Plugin: PluginConfig{
			Enabled:         true,
			HotReload:       true,
			WatchIntervalMs: 2000,
			Sandboxing: PluginSandboxConfig{
				Enabled:          true,
				MaxMemoryMB:      256,
				MaxCPUPercent:    50.0,
				MaxGoroutines:    100,
				MaxFileHandles:   50,
				MaxNetConns:      20,
				ExecutionTimeout: 300,
				DeniedPaths:      []string{"/etc/passwd", "/etc/shadow", "~/.ssh"},
				DefaultPerms:     []string{"file:read", "network:outbound", "env:read", "system:info"},
				LogViolations:    true,
				TerminateOnLimit: false,
			},
			Lifecycle: PluginLifecycleConfig{
				InitTimeoutSecs:    30,
				StartTimeoutSecs:   30,
				StopTimeoutSecs:    15,
				HealthIntervalSecs: 30,
				HealthTimeoutSecs:  5,
				MaxHealthFails:     3,
				GracefulShutdown:   true,
				RetryOnError:       true,
				MaxRetries:         3,
			},
			EventBus: PluginEventBusConfig{
				BufferSize: 1000,
				Workers:    4,
			},
		},
		Providers: ProvidersConfig{
			DefaultProvider: "openai",
			Providers: []ProviderConfig{
				{
					Type:      "openai",
					Name:      "OpenAI",
					APIKeyEnv: "OPENAI_API_KEY",
					Enabled:   true,
					Priority:  100,
					Weight:    1,
					Models:    []string{"gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1", "o1-mini", "o3-mini"},
				},
				{
					Type:      "anthropic",
					Name:      "Anthropic",
					APIKeyEnv: "ANTHROPIC_API_KEY",
					Enabled:   true,
					Priority:  90,
					Weight:    1,
					Models:    []string{"claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"},
				},
				{
					Type:      "google",
					Name:      "Google AI",
					APIKeyEnv: "GOOGLE_API_KEY",
					Enabled:   true,
					Priority:  80,
					Weight:    1,
					Models:    []string{"gemini-2.0-flash-exp", "gemini-1.5-pro", "gemini-1.5-flash"},
				},
				{
					Type:     "ollama",
					Name:     "Ollama",
					BaseURL:  "http://localhost:11434",
					Enabled:  true,
					Priority: 70,
					Weight:   1,
					Models:   []string{"llama3.3", "llama3.2", "qwen2.5-coder", "deepseek-r1", "mistral"},
				},
			},
			Routing: RoutingConfig{
				Strategy:         "priority",
				MaxRetries:       3,
				RetryDelayMs:     100,
				CircuitBreaker:   true,
				FailureThreshold: 5,
				RecoveryTimeSec:  30,
			},
			ModelSelection: ModelSelConfig{
				PreferLocal:   false,
				PreferFast:    false,
				PreferCheap:   false,
				PreferQuality: true,
				FallbackModel: "gpt-4o-mini",
			},
		},
	}
}

// ConfigDir returns the SuperAI config directory path
func ConfigDir() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(homeDir, ".superai"), nil
}

// ConfigPath returns the full path to the config file
func ConfigPath() (string, error) {
	dir, err := ConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "config.yaml"), nil
}

// Load reads config from disk or returns default config
func Load() (*Config, error) {
	configPath, err := ConfigPath()
	if err != nil {
		return DefaultConfig(), nil
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			// Return default config if file doesn't exist
			return DefaultConfig(), nil
		}
		return nil, err
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}

	return &cfg, nil
}

// Save writes config to disk
func Save(cfg *Config) error {
	configPath, err := ConfigPath()
	if err != nil {
		return err
	}

	// Ensure directory exists
	dir := filepath.Dir(configPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	data, err := yaml.Marshal(cfg)
	if err != nil {
		return err
	}

	return os.WriteFile(configPath, data, 0644)
}

// EnsureConfigExists creates default config if it doesn't exist
func EnsureConfigExists() error {
	configPath, err := ConfigPath()
	if err != nil {
		return err
	}

	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return Save(DefaultConfig())
	}
	return nil
}

// DetectAgent checks if an agent binary is available in PATH
func DetectAgent(command string) bool {
	_, err := LookPath(command)
	return err == nil
}

// LookPath searches for an executable in PATH
func LookPath(file string) (string, error) {
	// Check common locations first
	paths := []string{
		file,
		filepath.Join("/usr/local/bin", file),
		filepath.Join("/usr/bin", file),
	}

	// Add Windows paths
	if os.Getenv("OS") == "Windows_NT" {
		homeDir, _ := os.UserHomeDir()
		paths = append(paths,
			filepath.Join(homeDir, "AppData", "Local", "Programs", file, file+".exe"),
			filepath.Join(homeDir, ".cargo", "bin", file+".exe"),
			filepath.Join(homeDir, "go", "bin", file+".exe"),
		)
	} else {
		homeDir, _ := os.UserHomeDir()
		paths = append(paths,
			filepath.Join(homeDir, ".cargo", "bin", file),
			filepath.Join(homeDir, "go", "bin", file),
			filepath.Join(homeDir, ".local", "bin", file),
		)
	}

	for _, p := range paths {
		if _, err := os.Stat(p); err == nil {
			return p, nil
		}
	}

	// Fall back to exec.LookPath behavior
	pathEnv := os.Getenv("PATH")
	for _, dir := range filepath.SplitList(pathEnv) {
		path := filepath.Join(dir, file)
		if _, err := os.Stat(path); err == nil {
			return path, nil
		}
		// Try with .exe on Windows
		if os.Getenv("OS") == "Windows_NT" {
			path = filepath.Join(dir, file+".exe")
			if _, err := os.Stat(path); err == nil {
				return path, nil
			}
		}
	}

	return "", os.ErrNotExist
}
