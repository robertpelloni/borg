package tui

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/aios/superai-cli/internal/agent"
	"github.com/aios/superai-cli/internal/collaboration"
	"github.com/aios/superai-cli/internal/config"
	"github.com/aios/superai-cli/internal/git"
	"github.com/aios/superai-cli/internal/llm"
	"github.com/aios/superai-cli/internal/marketplace"
	"github.com/aios/superai-cli/internal/mcp"
	"github.com/aios/superai-cli/internal/metrics"
	"github.com/aios/superai-cli/internal/orchestrator"
	"github.com/aios/superai-cli/internal/plugin"
	providerPkg "github.com/aios/superai-cli/internal/provider"
	"github.com/aios/superai-cli/internal/remote"
	"github.com/aios/superai-cli/internal/session"
	"github.com/aios/superai-cli/internal/tui/components"
	"github.com/aios/superai-cli/internal/voice"
	"github.com/aios/superai-cli/internal/web"
	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

var (
	highlight = lipgloss.AdaptiveColor{Light: "#874BFD", Dark: "#7D56F4"}
	subtle    = lipgloss.AdaptiveColor{Light: "#D9DCCF", Dark: "#383838"}
	success   = lipgloss.AdaptiveColor{Light: "#04B575", Dark: "#04B575"}
	warning   = lipgloss.AdaptiveColor{Light: "#FFA500", Dark: "#FFA500"}
	danger    = lipgloss.AdaptiveColor{Light: "#FF0000", Dark: "#FF6B6B"}
	info      = lipgloss.AdaptiveColor{Light: "#3498DB", Dark: "#5DADE2"}

	docStyle = lipgloss.NewStyle().Padding(1, 2, 1, 2)

	sidebarStyle = lipgloss.NewStyle().
			Border(lipgloss.NormalBorder(), false, true, false, false).
			BorderForeground(subtle).
			Padding(0, 1).
			Width(30)

	mainStyle = lipgloss.NewStyle().
			Padding(0, 1)

	statusStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#FFFDF5")).
			Background(lipgloss.Color("#7D56F4")).
			Padding(0, 1).
			MarginRight(1)

	statusText = lipgloss.NewStyle().Foreground(lipgloss.Color("#A9ABAC"))

	infoStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#FFFDF5")).
			Background(lipgloss.Color("#3C3C3C")).
			Padding(0, 1)

	sectionStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#FFFDF5"))

	inputStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(highlight).
			Padding(0, 1)

	userMsgStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#7D56F4")).
			Bold(true)

	assistantMsgStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color("#04B575"))
)

type AgentStatus int

const (
	StatusStopped AgentStatus = iota
	StatusRunning
	StatusError
	StatusNotFound
)

func (s AgentStatus) String() string {
	switch s {
	case StatusRunning:
		return "●"
	case StatusError:
		return "✗"
	case StatusNotFound:
		return "?"
	default:
		return "○"
	}
}

func (s AgentStatus) Color() lipgloss.AdaptiveColor {
	switch s {
	case StatusRunning:
		return success
	case StatusError:
		return danger
	case StatusNotFound:
		return warning
	default:
		return subtle
	}
}

type PanelFocus int

const (
	FocusAgents PanelFocus = iota
	FocusTools
	FocusChat
)

type LogMsg string
type ToolsDiscoveredMsg []mcp.HubTool
type ToolExecutedMsg struct {
	Name   string
	Result interface{}
	Error  error
}
type ChatResponseMsg struct {
	Response string
	Error    error
}
type UsageUpdateMsg llm.Usage
type PoolResultMsg struct {
	Results []*collaboration.ResultPayload
}

// Session management messages
type SessionSavedMsg struct {
	SessionID string
	Name      string
	Error     error
}

type SessionLoadedMsg struct {
	Session *session.Session
	Error   error
}

type SessionListMsg struct {
	Sessions []session.SessionSummary
	Error    error
}

type SessionDeletedMsg struct {
	SessionID string
	Error     error
}

type AgentEntry struct {
	Config    config.AgentConfig
	Status    AgentStatus
	Available bool
}

type DashboardModel struct {
	width             int
	height            int
	agents            []AgentEntry
	tools             []mcp.HubTool
	activeAgent       int
	activeTool        int
	focus             PanelFocus
	viewport          viewport.Model
	textInput         textinput.Model
	logs              []string
	runner            *agent.Runner
	orchestrator      *orchestrator.Orchestrator
	mcpClient         *mcp.Client
	reactEngine       *llm.ReActEngine
	llmProvider       llm.Provider
	agentPool         *collaboration.AgentPool
	logChan           chan string
	ctx               context.Context
	cancel            context.CancelFunc
	cfg               *config.Config
	hubConnected      bool
	llmReady          bool
	poolReady         bool
	totalUsage        llm.Usage
	processing        bool
	sessionMgr        *session.Manager
	currentSession    *session.Session
	sessionList       []session.SessionSummary
	showSessions      bool
	activeSession     int
	tabBar            components.TabBar
	spinner           components.Spinner
	searchBar         components.SearchBar
	filterBar         components.FilterBar
	logHighlighter    components.LogHighlighter
	agentTabs         map[string][]string
	showSearch        bool
	showFilter        bool
	pluginMgr         *plugin.Manager
	showPlugins       bool
	activePlugin      int
	metricsCollector  *metrics.Collector
	showMetrics       bool
	chatStartTime     time.Time
	gitClient         *git.Client
	showGit           bool
	gitStatus         *git.RepoStatus
	remoteMgr         *remote.RemoteManager
	showRemotes       bool
	activeRemote      int
	market            *marketplace.Marketplace
	showMarket        bool
	marketSearch      string
	marketResults     []marketplace.PluginInfo
	activeMarketItem  int
	voiceInput        *voice.VoiceInput
	voiceEnabled      bool
	webServer         *web.Server
	webEnabled        bool
	mcpAggregator     *mcp.Aggregator
	mcpServersReady   bool
	llmBridge         *LLMBridge
	showProviders     bool
	activeProviderIdx int
	activeModelIdx    int
	providerModels    []string
	streamTokenCh     <-chan string
	streamErrCh       <-chan error
	streamBuffer      strings.Builder
	useStreaming      bool
	useReAct          bool
}

func NewDashboard() DashboardModel {
	vp := viewport.New(0, 0)
	vp.SetContent("Welcome to the SuperAI Mecha Suit Orchestrator.\nInitializing modules...")

	ti := textinput.New()
	ti.Placeholder = "Ask me anything... (Enter to send, Esc to exit chat)"
	ti.CharLimit = 2000
	ti.Width = 60

	ctx, cancel := context.WithCancel(context.Background())
	r := agent.NewRunner()
	logChan := make(chan string, 100)

	cfg, err := config.Load()
	if err != nil {
		cfg = config.DefaultConfig()
	}

	var agents []AgentEntry
	for _, ac := range cfg.Agents {
		if !ac.Enabled {
			continue
		}
		available := config.DetectAgent(ac.Command)
		status := StatusStopped
		if !available {
			status = StatusNotFound
		}
		agents = append(agents, AgentEntry{
			Config:    ac,
			Status:    status,
			Available: available,
		})
	}

	mcpCli := mcp.NewClient(cfg.MCPHub.URL)
	reg := orchestrator.NewRegistry()

	reg.Register(&orchestrator.Tool{
		Definition: orchestrator.ToolDefinition{
			Name:        "ls",
			Description: "List files in directory",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"path": map[string]interface{}{"type": "string", "description": "Directory path to list (default: current directory)"},
				},
			},
		},
		Handler: func(ctx context.Context, args json.RawMessage) (interface{}, error) {
			var params struct {
				Path string `json:"path"`
			}
			json.Unmarshal(args, &params)
			path := params.Path
			if path == "" {
				path = "."
			}
			out, err := exec.CommandContext(ctx, "ls", "-la", path).Output()
			if err != nil {
				return nil, err
			}
			return string(out), nil
		},
	})

	reg.Register(&orchestrator.Tool{
		Definition: orchestrator.ToolDefinition{
			Name:        "read_file",
			Description: "Read contents of a file",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"path": map[string]interface{}{"type": "string", "description": "Path to file to read"},
				},
				"required": []string{"path"},
			},
		},
		Handler: func(ctx context.Context, args json.RawMessage) (interface{}, error) {
			var params struct {
				Path string `json:"path"`
			}
			if err := json.Unmarshal(args, &params); err != nil {
				return nil, err
			}
			content, err := os.ReadFile(params.Path)
			if err != nil {
				return nil, err
			}
			return string(content), nil
		},
	})

	reg.Register(&orchestrator.Tool{
		Definition: orchestrator.ToolDefinition{
			Name:        "write_file",
			Description: "Write content to a file",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"path":    map[string]interface{}{"type": "string", "description": "Path to file to write"},
					"content": map[string]interface{}{"type": "string", "description": "Content to write to file"},
				},
				"required": []string{"path", "content"},
			},
		},
		Handler: func(ctx context.Context, args json.RawMessage) (interface{}, error) {
			var params struct {
				Path    string `json:"path"`
				Content string `json:"content"`
			}
			if err := json.Unmarshal(args, &params); err != nil {
				return nil, err
			}
			if err := os.WriteFile(params.Path, []byte(params.Content), 0644); err != nil {
				return nil, err
			}
			return fmt.Sprintf("Successfully wrote %d bytes to %s", len(params.Content), params.Path), nil
		},
	})

	reg.Register(&orchestrator.Tool{
		Definition: orchestrator.ToolDefinition{
			Name:        "shell_exec",
			Description: "Execute a shell command and return output",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"command": map[string]interface{}{"type": "string", "description": "Shell command to execute"},
				},
				"required": []string{"command"},
			},
		},
		Handler: func(ctx context.Context, args json.RawMessage) (interface{}, error) {
			var params struct {
				Command string `json:"command"`
			}
			if err := json.Unmarshal(args, &params); err != nil {
				return nil, err
			}
			var cmd *exec.Cmd
			if runtime.GOOS == "windows" {
				cmd = exec.CommandContext(ctx, "cmd", "/c", params.Command)
			} else {
				cmd = exec.CommandContext(ctx, "sh", "-c", params.Command)
			}
			out, err := cmd.CombinedOutput()
			if err != nil {
				return fmt.Sprintf("Error: %v\nOutput: %s", err, string(out)), nil
			}
			return string(out), nil
		},
	})

	reg.Register(&orchestrator.Tool{
		Definition: orchestrator.ToolDefinition{
			Name:        "search_files",
			Description: "Search for files matching a pattern using glob",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"pattern": map[string]interface{}{"type": "string", "description": "Glob pattern to match files (e.g., '**/*.go', '*.txt')"},
				},
				"required": []string{"pattern"},
			},
		},
		Handler: func(ctx context.Context, args json.RawMessage) (interface{}, error) {
			var params struct {
				Pattern string `json:"pattern"`
			}
			if err := json.Unmarshal(args, &params); err != nil {
				return nil, err
			}
			matches, err := filepath.Glob(params.Pattern)
			if err != nil {
				return nil, err
			}
			if len(matches) == 0 {
				return "No files found matching pattern", nil
			}
			return strings.Join(matches, "\n"), nil
		},
	})

	reg.Register(&orchestrator.Tool{
		Definition: orchestrator.ToolDefinition{
			Name:        "get_cwd",
			Description: "Get current working directory",
			InputSchema: map[string]interface{}{"type": "object"},
		},
		Handler: func(ctx context.Context, args json.RawMessage) (interface{}, error) {
			cwd, err := os.Getwd()
			if err != nil {
				return nil, err
			}
			return cwd, nil
		},
	})

	reg.Register(&orchestrator.Tool{
		Definition: orchestrator.ToolDefinition{
			Name:        "grep_search",
			Description: "Search for a pattern in files using regex",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"pattern":   map[string]interface{}{"type": "string", "description": "Regex pattern to search for"},
					"path":      map[string]interface{}{"type": "string", "description": "Directory or file path to search in (default: current directory)"},
					"file_glob": map[string]interface{}{"type": "string", "description": "File glob pattern to filter files (e.g., '*.go', '*.ts')"},
				},
				"required": []string{"pattern"},
			},
		},
		Handler: func(ctx context.Context, args json.RawMessage) (interface{}, error) {
			var params struct {
				Pattern  string `json:"pattern"`
				Path     string `json:"path"`
				FileGlob string `json:"file_glob"`
			}
			if err := json.Unmarshal(args, &params); err != nil {
				return nil, err
			}
			path := params.Path
			if path == "" {
				path = "."
			}
			cmdArgs := []string{"-rn", "--color=never"}
			if params.FileGlob != "" {
				cmdArgs = append(cmdArgs, "--include="+params.FileGlob)
			}
			cmdArgs = append(cmdArgs, params.Pattern, path)
			var cmd *exec.Cmd
			if runtime.GOOS == "windows" {
				cmd = exec.CommandContext(ctx, "findstr", "/s", "/n", params.Pattern, filepath.Join(path, "*"))
				if params.FileGlob != "" {
					cmd = exec.CommandContext(ctx, "findstr", "/s", "/n", params.Pattern, filepath.Join(path, params.FileGlob))
				}
			} else {
				cmd = exec.CommandContext(ctx, "grep", cmdArgs...)
			}
			out, err := cmd.CombinedOutput()
			if err != nil {
				if len(out) == 0 {
					return "No matches found", nil
				}
			}
			result := string(out)
			lines := strings.Split(result, "\n")
			if len(lines) > 100 {
				result = strings.Join(lines[:100], "\n") + fmt.Sprintf("\n... and %d more matches", len(lines)-100)
			}
			return result, nil
		},
	})

	reg.Register(&orchestrator.Tool{
		Definition: orchestrator.ToolDefinition{
			Name:        "git_status",
			Description: "Get git repository status including branch, staged, and modified files",
			InputSchema: map[string]interface{}{"type": "object"},
		},
		Handler: func(ctx context.Context, args json.RawMessage) (interface{}, error) {
			var cmd *exec.Cmd
			if runtime.GOOS == "windows" {
				cmd = exec.CommandContext(ctx, "cmd", "/c", "git status --porcelain -b")
			} else {
				cmd = exec.CommandContext(ctx, "sh", "-c", "git status --porcelain -b")
			}
			out, err := cmd.CombinedOutput()
			if err != nil {
				return fmt.Sprintf("Error: %v\nOutput: %s", err, string(out)), nil
			}
			return string(out), nil
		},
	})

	reg.Register(&orchestrator.Tool{
		Definition: orchestrator.ToolDefinition{
			Name:        "git_diff",
			Description: "Show git diff of changes (staged or unstaged)",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"staged": map[string]interface{}{"type": "boolean", "description": "Show staged changes (default: false, shows unstaged)"},
					"file":   map[string]interface{}{"type": "string", "description": "Specific file to diff (optional)"},
				},
			},
		},
		Handler: func(ctx context.Context, args json.RawMessage) (interface{}, error) {
			var params struct {
				Staged bool   `json:"staged"`
				File   string `json:"file"`
			}
			json.Unmarshal(args, &params)
			cmdStr := "git diff"
			if params.Staged {
				cmdStr += " --staged"
			}
			if params.File != "" {
				cmdStr += " -- " + params.File
			}
			var cmd *exec.Cmd
			if runtime.GOOS == "windows" {
				cmd = exec.CommandContext(ctx, "cmd", "/c", cmdStr)
			} else {
				cmd = exec.CommandContext(ctx, "sh", "-c", cmdStr)
			}
			out, err := cmd.CombinedOutput()
			if err != nil {
				return fmt.Sprintf("Error: %v\nOutput: %s", err, string(out)), nil
			}
			if len(out) == 0 {
				return "No changes", nil
			}
			return string(out), nil
		},
	})

	reg.Register(&orchestrator.Tool{
		Definition: orchestrator.ToolDefinition{
			Name:        "git_log",
			Description: "Show recent git commit history",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"count":   map[string]interface{}{"type": "integer", "description": "Number of commits to show (default: 10)"},
					"oneline": map[string]interface{}{"type": "boolean", "description": "Show compact one-line format (default: true)"},
				},
			},
		},
		Handler: func(ctx context.Context, args json.RawMessage) (interface{}, error) {
			var params struct {
				Count   int  `json:"count"`
				Oneline bool `json:"oneline"`
			}
			params.Count = 10
			params.Oneline = true
			json.Unmarshal(args, &params)
			if params.Count <= 0 {
				params.Count = 10
			}
			if params.Count > 50 {
				params.Count = 50
			}
			cmdStr := fmt.Sprintf("git log -%d", params.Count)
			if params.Oneline {
				cmdStr += " --oneline"
			}
			var cmd *exec.Cmd
			if runtime.GOOS == "windows" {
				cmd = exec.CommandContext(ctx, "cmd", "/c", cmdStr)
			} else {
				cmd = exec.CommandContext(ctx, "sh", "-c", cmdStr)
			}
			out, err := cmd.CombinedOutput()
			if err != nil {
				return fmt.Sprintf("Error: %v\nOutput: %s", err, string(out)), nil
			}
			return string(out), nil
		},
	})

	reg.Register(&orchestrator.Tool{
		Definition: orchestrator.ToolDefinition{
			Name:        "directory_tree",
			Description: "Show directory tree structure recursively",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"path":        map[string]interface{}{"type": "string", "description": "Directory path (default: current directory)"},
					"max_depth":   map[string]interface{}{"type": "integer", "description": "Maximum depth to traverse (default: 3)"},
					"show_hidden": map[string]interface{}{"type": "boolean", "description": "Show hidden files (default: false)"},
				},
			},
		},
		Handler: func(ctx context.Context, args json.RawMessage) (interface{}, error) {
			var params struct {
				Path       string `json:"path"`
				MaxDepth   int    `json:"max_depth"`
				ShowHidden bool   `json:"show_hidden"`
			}
			params.MaxDepth = 3
			json.Unmarshal(args, &params)
			if params.Path == "" {
				params.Path = "."
			}
			if params.MaxDepth <= 0 {
				params.MaxDepth = 3
			}
			if params.MaxDepth > 10 {
				params.MaxDepth = 10
			}
			var result strings.Builder
			var walk func(dir string, prefix string, depth int) error
			walk = func(dir string, prefix string, depth int) error {
				if depth > params.MaxDepth {
					return nil
				}
				entries, err := os.ReadDir(dir)
				if err != nil {
					return err
				}
				for i, entry := range entries {
					if !params.ShowHidden && strings.HasPrefix(entry.Name(), ".") {
						continue
					}
					isLast := i == len(entries)-1
					connector := "├── "
					if isLast {
						connector = "└── "
					}
					result.WriteString(prefix + connector + entry.Name())
					if entry.IsDir() {
						result.WriteString("/")
					}
					result.WriteString("\n")
					if entry.IsDir() {
						newPrefix := prefix + "│   "
						if isLast {
							newPrefix = prefix + "    "
						}
						walk(filepath.Join(dir, entry.Name()), newPrefix, depth+1)
					}
				}
				return nil
			}
			result.WriteString(params.Path + "\n")
			walk(params.Path, "", 1)
			return result.String(), nil
		},
	})

	reg.Register(&orchestrator.Tool{
		Definition: orchestrator.ToolDefinition{
			Name:        "git_add",
			Description: "Stage files for commit",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"files": map[string]interface{}{"type": "string", "description": "Files to stage (space-separated, or '.' for all)"},
				},
				"required": []string{"files"},
			},
		},
		Handler: func(ctx context.Context, args json.RawMessage) (interface{}, error) {
			var params struct {
				Files string `json:"files"`
			}
			if err := json.Unmarshal(args, &params); err != nil {
				return nil, err
			}
			if params.Files == "" {
				return "Error: files parameter required", nil
			}
			cmdStr := "git add " + params.Files
			var cmd *exec.Cmd
			if runtime.GOOS == "windows" {
				cmd = exec.CommandContext(ctx, "cmd", "/c", cmdStr)
			} else {
				cmd = exec.CommandContext(ctx, "sh", "-c", cmdStr)
			}
			out, err := cmd.CombinedOutput()
			if err != nil {
				return fmt.Sprintf("Error: %v\nOutput: %s", err, string(out)), nil
			}
			return "Files staged successfully", nil
		},
	})

	reg.Register(&orchestrator.Tool{
		Definition: orchestrator.ToolDefinition{
			Name:        "git_commit",
			Description: "Create a git commit with a message",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"message": map[string]interface{}{"type": "string", "description": "Commit message"},
				},
				"required": []string{"message"},
			},
		},
		Handler: func(ctx context.Context, args json.RawMessage) (interface{}, error) {
			var params struct {
				Message string `json:"message"`
			}
			if err := json.Unmarshal(args, &params); err != nil {
				return nil, err
			}
			if params.Message == "" {
				return "Error: message parameter required", nil
			}
			escapedMsg := strings.ReplaceAll(params.Message, `"`, `\"`)
			cmdStr := fmt.Sprintf(`git commit -m "%s"`, escapedMsg)
			var cmd *exec.Cmd
			if runtime.GOOS == "windows" {
				cmd = exec.CommandContext(ctx, "cmd", "/c", cmdStr)
			} else {
				cmd = exec.CommandContext(ctx, "sh", "-c", cmdStr)
			}
			out, err := cmd.CombinedOutput()
			if err != nil {
				return fmt.Sprintf("Error: %v\nOutput: %s", err, string(out)), nil
			}
			return string(out), nil
		},
	})

	reg.Register(&orchestrator.Tool{
		Definition: orchestrator.ToolDefinition{
			Name:        "git_branch",
			Description: "List, create, or switch git branches",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"action": map[string]interface{}{"type": "string", "description": "Action: list, create, switch, delete (default: list)"},
					"name":   map[string]interface{}{"type": "string", "description": "Branch name (required for create/switch/delete)"},
				},
			},
		},
		Handler: func(ctx context.Context, args json.RawMessage) (interface{}, error) {
			var params struct {
				Action string `json:"action"`
				Name   string `json:"name"`
			}
			params.Action = "list"
			json.Unmarshal(args, &params)
			var cmdStr string
			switch params.Action {
			case "list", "":
				cmdStr = "git branch -a"
			case "create":
				if params.Name == "" {
					return "Error: branch name required for create", nil
				}
				cmdStr = "git branch " + params.Name
			case "switch":
				if params.Name == "" {
					return "Error: branch name required for switch", nil
				}
				cmdStr = "git checkout " + params.Name
			case "delete":
				if params.Name == "" {
					return "Error: branch name required for delete", nil
				}
				cmdStr = "git branch -d " + params.Name
			default:
				return "Error: invalid action (use: list, create, switch, delete)", nil
			}
			var cmd *exec.Cmd
			if runtime.GOOS == "windows" {
				cmd = exec.CommandContext(ctx, "cmd", "/c", cmdStr)
			} else {
				cmd = exec.CommandContext(ctx, "sh", "-c", cmdStr)
			}
			out, err := cmd.CombinedOutput()
			if err != nil {
				return fmt.Sprintf("Error: %v\nOutput: %s", err, string(out)), nil
			}
			return string(out), nil
		},
	})

	reg.Register(&orchestrator.Tool{
		Definition: orchestrator.ToolDefinition{
			Name:        "find_in_files",
			Description: "Find symbol definitions or patterns across codebase with context",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"pattern":    map[string]interface{}{"type": "string", "description": "Pattern to search (e.g., 'func Main', 'class User', 'def process')"},
					"file_types": map[string]interface{}{"type": "string", "description": "File extensions to search (e.g., '*.go', '*.py', '*.ts')"},
					"context":    map[string]interface{}{"type": "integer", "description": "Lines of context around match (default: 2)"},
				},
				"required": []string{"pattern"},
			},
		},
		Handler: func(ctx context.Context, args json.RawMessage) (interface{}, error) {
			var params struct {
				Pattern   string `json:"pattern"`
				FileTypes string `json:"file_types"`
				Context   int    `json:"context"`
			}
			params.Context = 2
			if err := json.Unmarshal(args, &params); err != nil {
				return nil, err
			}
			if params.Context < 0 {
				params.Context = 0
			}
			if params.Context > 10 {
				params.Context = 10
			}
			var cmdArgs []string
			if runtime.GOOS == "windows" {
				cmdStr := fmt.Sprintf("findstr /s /n /c:\"%s\"", params.Pattern)
				if params.FileTypes != "" {
					cmdStr += " " + params.FileTypes
				} else {
					cmdStr += " *.*"
				}
				cmd := exec.CommandContext(ctx, "cmd", "/c", cmdStr)
				out, _ := cmd.CombinedOutput()
				if len(out) == 0 {
					return "No matches found", nil
				}
				return string(out), nil
			}
			cmdArgs = []string{"-rn", fmt.Sprintf("-C%d", params.Context), "--color=never"}
			if params.FileTypes != "" {
				cmdArgs = append(cmdArgs, "--include="+params.FileTypes)
			}
			cmdArgs = append(cmdArgs, params.Pattern, ".")
			cmd := exec.CommandContext(ctx, "grep", cmdArgs...)
			out, _ := cmd.CombinedOutput()
			if len(out) == 0 {
				return "No matches found", nil
			}
			lines := strings.Split(string(out), "\n")
			if len(lines) > 100 {
				return strings.Join(lines[:100], "\n") + fmt.Sprintf("\n... and %d more matches", len(lines)-100), nil
			}
			return string(out), nil
		},
	})

	orch := orchestrator.NewOrchestrator(reg)

	var provider llm.Provider
	var reactEngine *llm.ReActEngine
	var agentPool *collaboration.AgentPool
	llmReady := false
	poolReady := false

	apiKey := cfg.LLM.GetAPIKey()
	if apiKey != "" {
		provider = llm.NewOpenAIProvider(llm.ProviderConfig{
			APIKey:      apiKey,
			Model:       cfg.LLM.Model,
			BaseURL:     cfg.LLM.BaseURL,
			MaxTokens:   cfg.LLM.MaxTokens,
			Temperature: cfg.LLM.Temperature,
		})

		reactEngine = llm.NewReActEngine(llm.ReActConfig{
			Provider:      provider,
			MaxIterations: 10,
		})

		reactEngine.RegisterTool(
			"list_files",
			"List files in the current directory",
			map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
			func(ctx context.Context, args map[string]interface{}) (string, error) {
				out, err := exec.CommandContext(ctx, "ls", "-la").Output()
				if err != nil {
					return "", err
				}
				return string(out), nil
			},
		)

		reactEngine.RegisterTool(
			"read_file",
			"Read contents of a file",
			map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"path": map[string]interface{}{
						"type":        "string",
						"description": "Path to the file to read",
					},
				},
				"required": []string{"path"},
			},
			func(ctx context.Context, args map[string]interface{}) (string, error) {
				path, ok := args["path"].(string)
				if !ok {
					return "", fmt.Errorf("path must be a string")
				}
				out, err := exec.CommandContext(ctx, "cat", path).Output()
				if err != nil {
					return "", err
				}
				return string(out), nil
			},
		)

		reactEngine.RegisterTool(
			"run_command",
			"Run a shell command",
			map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"command": map[string]interface{}{
						"type":        "string",
						"description": "The shell command to run",
					},
				},
				"required": []string{"command"},
			},
			func(ctx context.Context, args map[string]interface{}) (string, error) {
				cmd, ok := args["command"].(string)
				if !ok {
					return "", fmt.Errorf("command must be a string")
				}
				out, err := exec.CommandContext(ctx, "sh", "-c", cmd).CombinedOutput()
				return string(out), err
			},
		)

		llmReady = true

		agentPool = collaboration.NewAgentPool(collaboration.PoolConfig{
			MaxAgents:       5,
			DefaultProvider: provider,
		})

		agentPool.AddAgent("researcher", "Research Agent", collaboration.RoleWorker, provider, []string{"research", "analysis"})
		agentPool.AddAgent("coder", "Coding Agent", collaboration.RoleWorker, provider, []string{"coding", "implementation"})
		agentPool.AddAgent("reviewer", "Review Agent", collaboration.RoleReviewer, provider, []string{"review", "verification"})

		agentPool.OnAgentStateChange = func(agentID string, state collaboration.AgentState) {
			logChan <- fmt.Sprintf("[Pool] Agent '%s' state: %s", agentID, state)
		}

		agentPool.OnTaskComplete = func(taskID string, result *collaboration.ResultPayload) {
			status := "completed"
			if !result.Success {
				status = "failed"
			}
			logChan <- fmt.Sprintf("[Pool] Task '%s' %s (%.2fs)", taskID, status, result.Metrics.Duration.Seconds())
		}

		poolReady = true
	}

	// Initialize session manager
	var sessionMgr *session.Manager
	var currentSession *session.Session
	sessionMgr, err = session.NewManager()
	if err != nil {
		logChan <- fmt.Sprintf("[Session] Failed to init manager: %v", err)
	} else {
		currentSession = session.NewSession("New Session")
		logChan <- fmt.Sprintf("[Session] Manager ready, new session: %s", currentSession.Metadata.ID[:8])
	}

	pluginDir, _ := config.ConfigDir()
	pluginMgr := plugin.NewManager(pluginDir)

	sessionID := "default"
	if currentSession != nil {
		sessionID = currentSession.Metadata.ID
	}
	metricsCollector := metrics.NewCollector(sessionID)

	cwd, _ := os.Getwd()
	gitClient := git.NewClient(cwd)
	var gitStatus *git.RepoStatus
	if gitClient.IsRepo() {
		gitStatus, _ = gitClient.Status()
	}

	remoteMgr := remote.NewRemoteManager()
	market := marketplace.NewMarketplace()
	voiceInput := voice.NewVoiceInput(nil)

	mcpAggregator := mcp.NewAggregator()
	for _, serverCfg := range cfg.MCPServers {
		if serverCfg.Enabled {
			mcpAggregator.AddServer(&mcp.ServerConfig{
				Name:        serverCfg.Name,
				Type:        mcp.TransportType(serverCfg.Type),
				Command:     serverCfg.Command,
				Args:        serverCfg.Args,
				URL:         serverCfg.URL,
				Headers:     serverCfg.Headers,
				Env:         serverCfg.Env,
				AutoApprove: serverCfg.AutoApprove,
				Enabled:     serverCfg.Enabled,
			})
		}
	}

	llmBridge := NewLLMBridge(BridgeConfig{
		UseNewSystem:  len(cfg.Providers.Providers) > 0,
		DefaultModel:  cfg.LLM.Model,
		MaxIterations: cfg.AgentLoop.MaxIterations,
		MaxTokens:     cfg.LLM.MaxTokens,
		SystemPrompt:  "",
		Persona:       cfg.AgentLoop.DefaultPersona,
	})

	if provider != nil {
		llmBridge.InitLegacyProvider(provider)
	}

	for _, provCfg := range cfg.Providers.Providers {
		if !provCfg.Enabled {
			continue
		}
		apiKey := provCfg.GetAPIKey()
		if apiKey == "" {
			logChan <- fmt.Sprintf("[Bridge] Provider '%s' skipped (no API key)", provCfg.Name)
			continue
		}

		newProvCfg := providerPkg.ProviderConfig{
			Type:       providerPkg.ProviderType(provCfg.Type),
			Name:       provCfg.Name,
			APIKey:     apiKey,
			BaseURL:    provCfg.BaseURL,
			OrgID:      provCfg.OrgID,
			ProjectID:  provCfg.ProjectID,
			Region:     provCfg.Region,
			MaxRetries: provCfg.MaxRetries,
			Timeout:    time.Duration(provCfg.TimeoutSec) * time.Second,
			Headers:    provCfg.Headers,
			Enabled:    provCfg.Enabled,
			Priority:   provCfg.Priority,
			Weight:     provCfg.Weight,
		}

		if err := llmBridge.InitNewProvider(provCfg.Name, newProvCfg); err != nil {
			logChan <- fmt.Sprintf("[Bridge] Failed to init provider '%s': %v", provCfg.Name, err)
		} else {
			logChan <- fmt.Sprintf("[Bridge] Provider '%s' initialized", provCfg.Name)
		}
	}

	llmBridge.SetCallbacks(
		func(thought string) {
			logChan <- fmt.Sprintf("[Thought] %s", thought)
		},
		func(action string, args map[string]interface{}) {
			logChan <- fmt.Sprintf("[Action] %s: %v", action, args)
		},
		func(tool string, result string) {
			if len(result) > 200 {
				result = result[:200] + "..."
			}
			logChan <- fmt.Sprintf("[Observation] %s: %s", tool, result)
		},
		func(token string) {
		},
	)

	if err := llmBridge.InitReActLoop(reg); err != nil {
		logChan <- fmt.Sprintf("[Bridge] ReAct loop init: %v", err)
	} else {
		logChan <- "[Bridge] ReAct loop initialized with tool registry"
	}

	return DashboardModel{
		agents:            agents,
		tools:             []mcp.HubTool{},
		activeAgent:       0,
		activeTool:        0,
		focus:             FocusAgents,
		viewport:          vp,
		textInput:         ti,
		logs:              []string{"[System] Initializing SuperAI CLI v1.9.0..."},
		runner:            r,
		orchestrator:      orch,
		mcpClient:         mcpCli,
		reactEngine:       reactEngine,
		llmProvider:       provider,
		agentPool:         agentPool,
		logChan:           logChan,
		ctx:               ctx,
		cancel:            cancel,
		cfg:               cfg,
		hubConnected:      false,
		llmReady:          llmReady,
		poolReady:         poolReady,
		totalUsage:        llm.Usage{},
		processing:        false,
		sessionMgr:        sessionMgr,
		currentSession:    currentSession,
		sessionList:       []session.SessionSummary{},
		showSessions:      false,
		activeSession:     0,
		tabBar:            components.NewTabBar(components.WithTabs([]components.Tab{{ID: "main", Title: "Main", Closable: false}})),
		spinner:           components.NewSpinner(),
		searchBar:         components.NewSearchBar(),
		filterBar:         components.NewFilterBar(),
		logHighlighter:    components.NewLogHighlighter(),
		agentTabs:         make(map[string][]string),
		showSearch:        false,
		showFilter:        false,
		pluginMgr:         pluginMgr,
		showPlugins:       false,
		activePlugin:      0,
		metricsCollector:  metricsCollector,
		showMetrics:       false,
		gitClient:         gitClient,
		showGit:           false,
		gitStatus:         gitStatus,
		remoteMgr:         remoteMgr,
		showRemotes:       false,
		activeRemote:      0,
		market:            market,
		showMarket:        false,
		marketSearch:      "",
		marketResults:     []marketplace.PluginInfo{},
		activeMarketItem:  0,
		voiceInput:        voiceInput,
		voiceEnabled:      voiceInput.IsAvailable(),
		webServer:         web.NewServer(nil),
		webEnabled:        true,
		mcpAggregator:     mcpAggregator,
		mcpServersReady:   false,
		llmBridge:         llmBridge,
		showProviders:     false,
		activeProviderIdx: 0,
		activeModelIdx:    0,
		providerModels:    []string{},
	}
}

func (m DashboardModel) Init() tea.Cmd {
	return tea.Batch(m.waitForLog(), m.discoverTools(), m.detectAgents(), m.pingHub(), m.checkLLM(), m.checkPool(), m.checkSession(), m.checkPlugins())
}

// Plugin messages
type PluginsLoadedMsg struct {
	Count int
	Error error
}

func (m DashboardModel) checkPlugins() tea.Cmd {
	return func() tea.Msg {
		if m.pluginMgr == nil {
			return LogMsg("[Plugins] Plugin manager not initialized")
		}

		err := m.pluginMgr.LoadAll(m.ctx)
		if err != nil {
			return PluginsLoadedMsg{Count: 0, Error: err}
		}

		plugins := m.pluginMgr.List()
		return PluginsLoadedMsg{Count: len(plugins), Error: nil}
	}
}

func (m DashboardModel) checkLLM() tea.Cmd {
	return func() tea.Msg {
		if m.llmReady {
			return LogMsg(fmt.Sprintf("[LLM] Provider ready: %s (%s)", m.llmProvider.Name(), m.llmProvider.Model()))
		}
		return LogMsg("[LLM] No API key configured. Set OPENAI_API_KEY or update ~/.superai/config.yaml")
	}
}

func (m DashboardModel) checkPool() tea.Cmd {
	return func() tea.Msg {
		if m.poolReady && m.agentPool != nil {
			stats := m.agentPool.Stats()
			return LogMsg(fmt.Sprintf("[Pool] Multi-agent pool ready: %d agents", stats.TotalAgents))
		}
		return LogMsg("[Pool] Multi-agent pool not initialized (requires LLM)")
	}
}

func (m DashboardModel) checkSession() tea.Cmd {
	return func() tea.Msg {
		if m.sessionMgr != nil {
			sessions, err := m.sessionMgr.GetRecent(5)
			if err == nil && len(sessions) > 0 {
				return LogMsg(fmt.Sprintf("[Session] Found %d saved sessions", len(sessions)))
			}
		}
		return LogMsg("[Session] No previous sessions found")
	}
}

func (m DashboardModel) pingHub() tea.Cmd {
	return func() tea.Msg {
		err := m.mcpClient.Ping()
		if err != nil {
			return LogMsg(fmt.Sprintf("[MCP] Hub offline: %v", err))
		}
		return LogMsg("[MCP] Hub connected at " + m.cfg.MCPHub.URL)
	}
}

func (m DashboardModel) detectAgents() tea.Cmd {
	return func() tea.Msg {
		var detected []string
		var missing []string
		for _, ae := range m.agents {
			if ae.Available {
				detected = append(detected, ae.Config.Name)
			} else {
				missing = append(missing, ae.Config.Name)
			}
		}
		msg := fmt.Sprintf("[System] Agents detected: %s", strings.Join(detected, ", "))
		if len(missing) > 0 {
			msg += fmt.Sprintf(" | Not found: %s", strings.Join(missing, ", "))
		}
		return LogMsg(msg)
	}
}

func (m DashboardModel) discoverTools() tea.Cmd {
	return func() tea.Msg {
		tools, err := m.mcpClient.ListTools()
		if err != nil {
			return LogMsg(fmt.Sprintf("[MCP] Failed to discover tools: %v", err))
		}
		return ToolsDiscoveredMsg(tools)
	}
}

func (m DashboardModel) waitForLog() tea.Cmd {
	return func() tea.Msg {
		msg, ok := <-m.logChan
		if !ok {
			return nil
		}
		return LogMsg(msg)
	}
}

func (m *DashboardModel) startAgent(idx int) tea.Cmd {
	if idx < 0 || idx >= len(m.agents) {
		return nil
	}
	ae := &m.agents[idx]
	if !ae.Available {
		m.logChan <- fmt.Sprintf("[Error] Agent '%s' not found in PATH (command: %s)", ae.Config.Name, ae.Config.Command)
		return nil
	}
	if ae.Status == StatusRunning {
		m.logChan <- fmt.Sprintf("[System] Agent '%s' is already running", ae.Config.Name)
		return nil
	}

	m.runner.AddAgent(&agent.Agent{
		Name:    ae.Config.Name,
		Command: ae.Config.Command,
		Args:    ae.Config.Args,
		Dir:     ae.Config.Dir,
	})

	ae.Status = StatusRunning
	m.logChan <- fmt.Sprintf("[System] Starting agent '%s' (%s)...", ae.Config.Name, ae.Config.Description)

	go func() {
		err := m.runner.StreamOutput(m.ctx, ae.Config.Name, m.logChan)
		if err != nil {
			m.logChan <- fmt.Sprintf("[Error] Agent '%s' failed: %v", ae.Config.Name, err)
			ae.Status = StatusError
		} else {
			m.logChan <- fmt.Sprintf("[System] Agent '%s' exited", ae.Config.Name)
			ae.Status = StatusStopped
		}
	}()

	return nil
}

func (m *DashboardModel) executeMCPTool(idx int) tea.Cmd {
	if idx < 0 || idx >= len(m.tools) {
		return nil
	}
	tool := m.tools[idx]
	m.logChan <- fmt.Sprintf("[MCP] Executing tool '%s'...", tool.Name)

	return func() tea.Msg {
		result, err := m.mcpClient.ExecuteTool(m.ctx, tool.Name, map[string]interface{}{})
		return ToolExecutedMsg{
			Name:   tool.Name,
			Result: result,
			Error:  err,
		}
	}
}

// Session management methods
func (m *DashboardModel) saveSession() tea.Cmd {
	if m.sessionMgr == nil || m.currentSession == nil {
		m.logChan <- "[Session] Session manager not initialized"
		return nil
	}

	// Update session with current conversation
	if m.llmBridge != nil && m.llmBridge.IsReady() {
		m.currentSession.Messages = session.ConvertLLMMessages(m.llmBridge.GetHistory())
	} else if m.reactEngine != nil {
		m.currentSession.Messages = session.ConvertLLMMessages(m.reactEngine.GetHistory())
	}
	m.currentSession.Usage = session.UsageStats{
		TotalPromptTokens:     m.totalUsage.PromptTokens,
		TotalCompletionTokens: m.totalUsage.CompletionTokens,
		TotalTokens:           m.totalUsage.TotalTokens,
		RequestCount:          m.totalUsage.TotalTokens / 100,
	}

	return func() tea.Msg {
		err := m.sessionMgr.Save(m.currentSession)
		return SessionSavedMsg{
			SessionID: m.currentSession.Metadata.ID,
			Name:      m.currentSession.Metadata.Name,
			Error:     err,
		}
	}
}

func (m *DashboardModel) loadSessionList() tea.Cmd {
	if m.sessionMgr == nil {
		return nil
	}

	return func() tea.Msg {
		sessions, err := m.sessionMgr.List()
		return SessionListMsg{
			Sessions: sessions,
			Error:    err,
		}
	}
}

func (m *DashboardModel) loadSession(id string) tea.Cmd {
	if m.sessionMgr == nil {
		return nil
	}

	return func() tea.Msg {
		s, err := m.sessionMgr.Load(id)
		return SessionLoadedMsg{
			Session: s,
			Error:   err,
		}
	}
}

func (m *DashboardModel) newSession() {
	if m.sessionMgr == nil {
		return
	}

	// Save current session first if it has content
	if m.currentSession != nil && len(m.currentSession.Messages) > 0 {
		m.sessionMgr.Save(m.currentSession)
	}

	// Create new session
	m.currentSession = session.NewSession("New Session")

	// Clear conversation history
	if m.llmBridge != nil {
		m.llmBridge.ClearHistory()
	}
	if m.reactEngine != nil {
		m.reactEngine.ClearHistory()
	}

	m.logs = append(m.logs, fmt.Sprintf("[Session] New session created: %s", m.currentSession.Metadata.ID[:8]))
	m.viewport.SetContent(strings.Join(m.logs, "\n"))
	m.viewport.GotoBottom()
}

func (m *DashboardModel) deleteSession(id string) tea.Cmd {
	if m.sessionMgr == nil {
		return nil
	}

	return func() tea.Msg {
		err := m.sessionMgr.Delete(id)
		return SessionDeletedMsg{
			SessionID: id,
			Error:     err,
		}
	}
}

func (m *DashboardModel) sendChat(message string) tea.Cmd {
	if m.llmBridge == nil || !m.llmBridge.IsReady() {
		if !m.llmReady || m.reactEngine == nil {
			m.logs = append(m.logs, "[Error] LLM not configured. Set OPENAI_API_KEY environment variable.")
			return nil
		}
	}

	m.processing = true
	m.chatStartTime = time.Now()
	m.logs = append(m.logs, "")
	m.logs = append(m.logs, userMsgStyle.Render("You: ")+message)
	m.logs = append(m.logs, assistantMsgStyle.Render("Assistant: ")+"thinking...")

	spinnerCmd := m.spinner.Start()

	if m.currentSession != nil {
		m.currentSession.AddMessage("user", message, nil)
	}

	chatCmd := func() tea.Msg {
		var response string
		var err error

		if m.llmBridge != nil && m.llmBridge.IsReady() {
			response, err = m.llmBridge.Chat(m.ctx, message)
		} else if m.reactEngine != nil {
			response, err = m.reactEngine.Run(m.ctx, message)
		} else {
			err = fmt.Errorf("no LLM provider available")
		}

		return ChatResponseMsg{
			Response: response,
			Error:    err,
		}
	}

	return tea.Batch(spinnerCmd, chatCmd)
}

func (m *DashboardModel) sendChatStream(message string) tea.Cmd {
	if m.llmBridge == nil || !m.llmBridge.IsReady() {
		m.logs = append(m.logs, "[Error] LLM not configured for streaming")
		return nil
	}

	m.processing = true
	m.chatStartTime = time.Now()
	m.streamBuffer.Reset()
	m.logs = append(m.logs, "")
	m.logs = append(m.logs, userMsgStyle.Render("You: ")+message)
	m.logs = append(m.logs, assistantMsgStyle.Render("Assistant: "))

	if m.currentSession != nil {
		m.currentSession.AddMessage("user", message, nil)
	}

	m.streamTokenCh, m.streamErrCh = m.llmBridge.ChatStream(m.ctx, message)

	spinnerCmd := m.spinner.Start()
	return tea.Batch(spinnerCmd, m.readNextStreamToken())
}

func (m *DashboardModel) readNextStreamToken() tea.Cmd {
	return func() tea.Msg {
		select {
		case token, ok := <-m.streamTokenCh:
			if !ok {
				return ChatStreamDoneMsg{Message: ChatMessage{Role: "assistant", Content: m.streamBuffer.String(), Timestamp: time.Now()}}
			}
			m.streamBuffer.WriteString(token)
			return ChatStreamChunkMsg{Content: token}
		case err, ok := <-m.streamErrCh:
			if ok && err != nil {
				return ChatResponseMsg{Response: m.streamBuffer.String(), Error: err}
			}
			return nil
		}
	}
}

func (m *DashboardModel) sendChatReAct(message string) tea.Cmd {
	if m.llmBridge == nil || !m.llmBridge.IsReady() {
		m.logs = append(m.logs, "[Error] LLM not configured for ReAct")
		return nil
	}

	m.processing = true
	m.chatStartTime = time.Now()
	m.logs = append(m.logs, "")
	m.logs = append(m.logs, userMsgStyle.Render("You: ")+message)
	m.logs = append(m.logs, assistantMsgStyle.Render("Assistant (ReAct): ")+"thinking...")

	if m.currentSession != nil {
		m.currentSession.AddMessage("user", message, nil)
	}

	spinnerCmd := m.spinner.Start()

	reactCmd := func() tea.Msg {
		response, err := m.llmBridge.RunReAct(m.ctx, message)
		return ChatResponseMsg{Response: response, Error: err}
	}

	return tea.Batch(spinnerCmd, reactCmd)
}

func (m *DashboardModel) runParallelTask(message string) tea.Cmd {
	if !m.poolReady || m.agentPool == nil {
		m.logs = append(m.logs, "[Error] Agent pool not ready")
		return nil
	}

	m.processing = true
	m.logs = append(m.logs, "")
	m.logs = append(m.logs, userMsgStyle.Render("You (parallel): ")+message)
	m.logs = append(m.logs, assistantMsgStyle.Render("Pool: ")+"dispatching to agents...")

	spinnerCmd := m.spinner.Start()

	tasks := []collaboration.TaskPayload{
		{Description: "Research and analyze: " + message, Context: map[string]interface{}{"specialty": "research"}},
		{Description: "Implement solution for: " + message, Context: map[string]interface{}{"specialty": "coding"}},
	}

	poolCmd := func() tea.Msg {
		resultsChan := m.agentPool.SubmitParallelTasks(tasks)

		var results []*collaboration.ResultPayload
		for result := range resultsChan {
			results = append(results, result)
		}

		return PoolResultMsg{Results: results}
	}

	return tea.Batch(spinnerCmd, poolCmd)
}

func (m DashboardModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var (
		cmd  tea.Cmd
		cmds []tea.Cmd
	)

	switch msg := msg.(type) {
	case PluginsLoadedMsg:
		if msg.Error != nil {
			m.logs = append(m.logs, fmt.Sprintf("[Plugins] Load failed: %v", msg.Error))
		} else if msg.Count > 0 {
			m.logs = append(m.logs, fmt.Sprintf("[Plugins] Loaded %d plugins", msg.Count))
		} else {
			m.logs = append(m.logs, "[Plugins] No plugins found in ~/.superai/plugins/")
		}
		m.viewport.SetContent(strings.Join(m.logs, "\n"))
		m.viewport.GotoBottom()

	case SessionSavedMsg:
		if msg.Error != nil {
			m.logs = append(m.logs, fmt.Sprintf("[Session] Save failed: %v", msg.Error))
		} else {
			m.logs = append(m.logs, fmt.Sprintf("[Session] Saved: %s (%s)", msg.Name, msg.SessionID[:8]))
		}
		m.viewport.SetContent(strings.Join(m.logs, "\n"))
		m.viewport.GotoBottom()

	case SessionLoadedMsg:
		if msg.Error != nil {
			m.logs = append(m.logs, fmt.Sprintf("[Session] Load failed: %v", msg.Error))
		} else {
			m.currentSession = msg.Session
			m.showSessions = false

			// Restore conversation history to react engine and llmBridge
			if m.llmBridge != nil {
				m.llmBridge.ClearHistory()
				for _, sm := range msg.Session.Messages {
					if sm.Role == "user" {
						m.llmBridge.AddUserMessage(sm.Content)
					} else if sm.Role == "assistant" {
						m.llmBridge.AddAssistantMessage(sm.Content)
					}
				}
			}
			if m.reactEngine != nil {
				m.reactEngine.ClearHistory()
				llmMsgs := session.ToLLMMessages(msg.Session.Messages)
				histJSON, _ := json.Marshal(llmMsgs)
				m.reactEngine.LoadHistoryFromJSON(histJSON)
			}

			// Restore logs with conversation
			m.logs = append(m.logs, fmt.Sprintf("[Session] Loaded: %s (%d messages)",
				msg.Session.Metadata.Name, len(msg.Session.Messages)))
			m.logs = append(m.logs, "--- Session History ---")
			for _, sm := range msg.Session.Messages {
				if sm.Role == "user" {
					m.logs = append(m.logs, userMsgStyle.Render("You: ")+sm.Content)
				} else if sm.Role == "assistant" {
					m.logs = append(m.logs, assistantMsgStyle.Render("Assistant: ")+sm.Content)
				}
			}
			m.logs = append(m.logs, "--- End History ---")
			m.logs = append(m.logs, "")
		}
		m.viewport.SetContent(strings.Join(m.logs, "\n"))
		m.viewport.GotoBottom()

	case SessionListMsg:
		if msg.Error != nil {
			m.logs = append(m.logs, fmt.Sprintf("[Session] List failed: %v", msg.Error))
			m.viewport.SetContent(strings.Join(m.logs, "\n"))
			m.viewport.GotoBottom()
		} else {
			m.sessionList = msg.Sessions
			m.showSessions = true
			m.activeSession = 0
			m.logs = append(m.logs, fmt.Sprintf("[Session] Found %d sessions", len(msg.Sessions)))
			m.viewport.SetContent(strings.Join(m.logs, "\n"))
			m.viewport.GotoBottom()
		}

	case SessionDeletedMsg:
		if msg.Error != nil {
			m.logs = append(m.logs, fmt.Sprintf("[Session] Delete failed: %v", msg.Error))
		} else {
			m.logs = append(m.logs, fmt.Sprintf("[Session] Deleted: %s", msg.SessionID[:8]))
			// Refresh list
			cmds = append(cmds, m.loadSessionList())
		}
		m.viewport.SetContent(strings.Join(m.logs, "\n"))
		m.viewport.GotoBottom()

	case PoolResultMsg:
		m.processing = false
		m.spinner.Stop()
		if len(m.logs) > 0 {
			m.logs = m.logs[:len(m.logs)-1]
		}

		aggregated, err := collaboration.AggregateResults(msg.Results, collaboration.StrategyMerge)
		if err != nil {
			m.logs = append(m.logs, assistantMsgStyle.Render("Pool: ")+fmt.Sprintf("[Error] %v", err))
		} else {
			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("Parallel execution complete (%d tasks, %.0f%% success)\n\n",
				aggregated.TotalResults, float64(aggregated.Successful)/float64(aggregated.TotalResults)*100))

			for i, result := range msg.Results {
				status := "✓"
				if !result.Success {
					status = "✗"
				}
				output := fmt.Sprintf("%v", result.Output)
				if len(output) > 200 {
					output = output[:200] + "..."
				}
				sb.WriteString(fmt.Sprintf("[Agent %d] %s %s\n", i+1, status, output))
			}

			m.logs = append(m.logs, assistantMsgStyle.Render("Pool: ")+sb.String())
		}
		m.logs = append(m.logs, "")
		m.viewport.SetContent(strings.Join(m.logs, "\n"))
		m.viewport.GotoBottom()

	case ChatResponseMsg:
		m.processing = false
		m.spinner.Stop()
		duration := time.Since(m.chatStartTime)
		if len(m.logs) > 0 {
			m.logs = m.logs[:len(m.logs)-1]
		}

		providerName := "unknown"
		modelName := "unknown"
		if m.llmBridge != nil {
			providerName = m.llmBridge.GetProviderName()
			modelName = m.llmBridge.GetModel()
		} else if m.llmProvider != nil {
			providerName = m.llmProvider.Name()
			modelName = m.llmProvider.Model()
		}

		if msg.Error != nil {
			m.logs = append(m.logs, assistantMsgStyle.Render("Assistant: ")+fmt.Sprintf("[Error] %v", msg.Error))
			if m.metricsCollector != nil {
				m.metricsCollector.Record(metrics.RequestMetrics{
					ID:           fmt.Sprintf("req_%d", time.Now().UnixNano()),
					Provider:     providerName,
					Model:        modelName,
					Duration:     duration,
					Timestamp:    time.Now(),
					Success:      false,
					ErrorMessage: msg.Error.Error(),
				})
			}
		} else {
			m.logs = append(m.logs, assistantMsgStyle.Render("Assistant: ")+msg.Response)
			if m.currentSession != nil {
				m.currentSession.AddMessage("assistant", msg.Response, nil)
			}
			if m.metricsCollector != nil {
				m.metricsCollector.Record(metrics.RequestMetrics{
					ID:       fmt.Sprintf("req_%d", time.Now().UnixNano()),
					Provider: providerName,
					Model:    modelName,
					Tokens: metrics.TokenUsage{
						InputTokens:  int64(m.totalUsage.PromptTokens),
						OutputTokens: int64(m.totalUsage.CompletionTokens),
						TotalTokens:  int64(m.totalUsage.TotalTokens),
					},
					Duration:  duration,
					Timestamp: time.Now(),
					Success:   true,
				})
			}
		}
		m.logs = append(m.logs, "")
		m.viewport.SetContent(strings.Join(m.logs, "\n"))
		m.viewport.GotoBottom()

	case UsageUpdateMsg:
		m.totalUsage = llm.Usage(msg)

	case ChatStreamChunkMsg:
		if len(m.logs) > 0 {
			m.logs[len(m.logs)-1] += msg.Content
			m.viewport.SetContent(strings.Join(m.logs, "\n"))
			m.viewport.GotoBottom()
		}
		if m.streamTokenCh != nil {
			return m, m.readNextStreamToken()
		}

	case ChatStreamDoneMsg:
		m.processing = false
		m.spinner.Stop()
		duration := time.Since(m.chatStartTime)
		if m.currentSession != nil {
			m.currentSession.AddMessage("assistant", msg.Message.Content, nil)
		}
		providerName := "unknown"
		modelName := "unknown"
		if m.llmBridge != nil {
			providerName = m.llmBridge.GetProviderName()
			modelName = m.llmBridge.GetModel()
		}
		if m.metricsCollector != nil {
			m.metricsCollector.Record(metrics.RequestMetrics{
				ID:       fmt.Sprintf("req_%d", time.Now().UnixNano()),
				Provider: providerName,
				Model:    modelName,
				Tokens: metrics.TokenUsage{
					InputTokens:  int64(m.totalUsage.PromptTokens),
					OutputTokens: int64(m.totalUsage.CompletionTokens),
					TotalTokens:  int64(m.totalUsage.TotalTokens),
				},
				Duration:  duration,
				Timestamp: time.Now(),
				Success:   true,
			})
		}
		m.logs = append(m.logs, "")
		m.viewport.SetContent(strings.Join(m.logs, "\n"))
		m.viewport.GotoBottom()

	case ToolsDiscoveredMsg:
		m.tools = []mcp.HubTool(msg)
		m.hubConnected = true
		m.logs = append(m.logs, fmt.Sprintf("[MCP] Discovered %d tools from hub", len(m.tools)))
		m.viewport.SetContent(strings.Join(m.logs, "\n"))
		m.viewport.GotoBottom()

	case ToolExecutedMsg:
		if msg.Error != nil {
			m.logs = append(m.logs, fmt.Sprintf("[MCP] Tool '%s' failed: %v", msg.Name, msg.Error))
		} else {
			resultStr := fmt.Sprintf("%v", msg.Result)
			if len(resultStr) > 500 {
				resultStr = resultStr[:500] + "..."
			}
			m.logs = append(m.logs, fmt.Sprintf("[MCP] Tool '%s' result:\n%s", msg.Name, resultStr))
		}
		m.viewport.SetContent(strings.Join(m.logs, "\n"))
		m.viewport.GotoBottom()

	case LogMsg:
		highlightedLog := m.logHighlighter.Highlight(string(msg))
		m.logs = append(m.logs, highlightedLog)
		if len(m.logs) > 500 {
			m.logs = m.logs[1:]
		}
		m.viewport.SetContent(strings.Join(m.logs, "\n"))
		m.viewport.GotoBottom()
		return m, m.waitForLog()

	case tea.KeyMsg:
		// Plugin list navigation mode
		if m.showPlugins {
			plugins := m.pluginMgr.List()
			switch msg.String() {
			case "esc":
				m.showPlugins = false
			case "up", "k":
				if m.activePlugin > 0 {
					m.activePlugin--
				}
			case "down", "j":
				if m.activePlugin < len(plugins)-1 {
					m.activePlugin++
				}
			case "enter":
				if m.activePlugin >= 0 && m.activePlugin < len(plugins) {
					p := plugins[m.activePlugin]
					if p.State == plugin.PluginStateLoaded {
						m.pluginMgr.Start(m.ctx, p.Path)
						m.logs = append(m.logs, fmt.Sprintf("[Plugins] Started: %s", p.Info.Name))
					} else if p.State == plugin.PluginStateActive {
						m.pluginMgr.Stop(m.ctx, p.Path)
						m.logs = append(m.logs, fmt.Sprintf("[Plugins] Stopped: %s", p.Info.Name))
					}
					m.viewport.SetContent(strings.Join(m.logs, "\n"))
					m.viewport.GotoBottom()
				}
			case "u":
				if m.activePlugin >= 0 && m.activePlugin < len(plugins) {
					p := plugins[m.activePlugin]
					m.pluginMgr.Unload(p.Path)
					m.logs = append(m.logs, fmt.Sprintf("[Plugins] Unloaded: %s", p.Info.Name))
					m.viewport.SetContent(strings.Join(m.logs, "\n"))
					m.viewport.GotoBottom()
				}
			}
		} else if m.showProviders {
			providers := m.llmBridge.ListProviders()
			switch msg.String() {
			case "esc", "P":
				m.showProviders = false
			case "up", "k":
				if m.activeProviderIdx > 0 {
					m.activeProviderIdx--
					if m.activeProviderIdx < len(providers) {
						m.providerModels = providers[m.activeProviderIdx].Models
						m.activeModelIdx = 0
					}
				}
			case "down", "j":
				if m.activeProviderIdx < len(providers)-1 {
					m.activeProviderIdx++
					if m.activeProviderIdx < len(providers) {
						m.providerModels = providers[m.activeProviderIdx].Models
						m.activeModelIdx = 0
					}
				}
			case "left", "h":
				if m.activeModelIdx > 0 {
					m.activeModelIdx--
				}
			case "right", "l":
				if m.activeModelIdx < len(m.providerModels)-1 {
					m.activeModelIdx++
				}
			case "enter":
				if m.activeProviderIdx >= 0 && m.activeProviderIdx < len(providers) {
					p := providers[m.activeProviderIdx]
					if err := m.llmBridge.SetActiveProvider(p.Name); err != nil {
						m.logs = append(m.logs, fmt.Sprintf("[Bridge] Failed to set provider: %v", err))
					} else {
						m.logs = append(m.logs, fmt.Sprintf("[Bridge] Active provider: %s", p.Name))
						if m.activeModelIdx >= 0 && m.activeModelIdx < len(m.providerModels) {
							model := m.providerModels[m.activeModelIdx]
							m.llmBridge.SetModel(model)
							m.logs = append(m.logs, fmt.Sprintf("[Bridge] Model: %s", model))
						}
					}
					m.viewport.SetContent(strings.Join(m.logs, "\n"))
					m.viewport.GotoBottom()
				}
			case "n":
				m.llmBridge.EnableNewSystem(!m.llmBridge.IsNewSystemEnabled())
				status := "disabled"
				if m.llmBridge.IsNewSystemEnabled() {
					status = "enabled"
				}
				m.logs = append(m.logs, fmt.Sprintf("[Bridge] New system %s", status))
				m.viewport.SetContent(strings.Join(m.logs, "\n"))
				m.viewport.GotoBottom()
			}
		} else if m.showSessions {
			switch msg.String() {
			case "esc":
				m.showSessions = false
			case "up", "k":
				if m.activeSession > 0 {
					m.activeSession--
				}
			case "down", "j":
				if m.activeSession < len(m.sessionList)-1 {
					m.activeSession++
				}
			case "enter":
				if m.activeSession >= 0 && m.activeSession < len(m.sessionList) {
					cmd = m.loadSession(m.sessionList[m.activeSession].ID)
					cmds = append(cmds, cmd)
				}
			case "d":
				if m.activeSession >= 0 && m.activeSession < len(m.sessionList) {
					cmd = m.deleteSession(m.sessionList[m.activeSession].ID)
					cmds = append(cmds, cmd)
				}
			}
		} else if m.focus == FocusChat {
			switch msg.String() {
			case "esc":
				m.focus = FocusAgents
				m.textInput.Blur()
			case "enter":
				if m.textInput.Value() != "" && !m.processing {
					message := m.textInput.Value()
					m.textInput.Reset()
					if m.useReAct && m.llmBridge != nil && m.llmBridge.IsReady() {
						cmd = m.sendChatReAct(message)
					} else if m.useStreaming && m.llmBridge != nil && m.llmBridge.IsReady() {
						cmd = m.sendChatStream(message)
					} else {
						cmd = m.sendChat(message)
					}
					cmds = append(cmds, cmd)
				}
			case "ctrl+s":
				m.useStreaming = !m.useStreaming
				mode := "OFF"
				if m.useStreaming {
					mode = "ON"
				}
				m.logs = append(m.logs, fmt.Sprintf("[Streaming mode: %s]", mode))
				m.viewport.SetContent(strings.Join(m.logs, "\n"))
				m.viewport.GotoBottom()
			case "ctrl+r":
				m.useReAct = !m.useReAct
				mode := "OFF"
				if m.useReAct {
					mode = "ON (tools enabled)"
				}
				m.logs = append(m.logs, fmt.Sprintf("[ReAct mode: %s]", mode))
				m.viewport.SetContent(strings.Join(m.logs, "\n"))
				m.viewport.GotoBottom()
			case "ctrl+p":
				if m.textInput.Value() != "" && !m.processing && m.poolReady {
					message := m.textInput.Value()
					m.textInput.Reset()
					cmd = m.runParallelTask(message)
					cmds = append(cmds, cmd)
				}
			default:
				m.textInput, cmd = m.textInput.Update(msg)
				cmds = append(cmds, cmd)
			}
		} else {
			switch msg.String() {
			case "ctrl+c", "q":
				// Auto-save session on quit
				if m.sessionMgr != nil && m.currentSession != nil && len(m.currentSession.Messages) > 0 {
					m.sessionMgr.Save(m.currentSession)
				}
				m.cancel()
				if m.agentPool != nil {
					m.agentPool.Stop()
				}
				return m, tea.Quit
			case "ctrl+s":
				cmd = m.saveSession()
				cmds = append(cmds, cmd)
			case "ctrl+l":
				cmd = m.loadSessionList()
				cmds = append(cmds, cmd)
			case "ctrl+n":
				m.newSession()
			case "tab":
				switch m.focus {
				case FocusAgents:
					m.focus = FocusTools
				case FocusTools:
					m.focus = FocusAgents
				}
			case "/", "c":
				m.focus = FocusChat
				m.textInput.Focus()
				cmds = append(cmds, textinput.Blink)
			case "up", "k":
				if m.focus == FocusAgents {
					if m.activeAgent > 0 {
						m.activeAgent--
					}
				} else {
					if m.activeTool > 0 {
						m.activeTool--
					}
				}
			case "down", "j":
				if m.focus == FocusAgents {
					if m.activeAgent < len(m.agents)-1 {
						m.activeAgent++
					}
				} else {
					if m.activeTool < len(m.tools)-1 {
						m.activeTool++
					}
				}
			case "s", "enter":
				if m.focus == FocusAgents {
					m.startAgent(m.activeAgent)
				} else {
					cmd = m.executeMCPTool(m.activeTool)
					cmds = append(cmds, cmd)
				}
			case "t":
				go func() {
					res, err := m.orchestrator.ExecuteTool(m.ctx, orchestrator.ToolCall{
						ToolName: "ls",
						Args:     json.RawMessage("{}"),
					})
					if err != nil {
						m.logChan <- fmt.Sprintf("[Error] Tool execution failed: %v", err)
					} else {
						m.logChan <- fmt.Sprintf("[Tool] ls result:\n%v", res)
					}
				}()
			case "r":
				cfg, err := config.Load()
				if err != nil {
					m.logChan <- fmt.Sprintf("[Error] Failed to reload config: %v", err)
				} else {
					m.cfg = cfg
					m.logChan <- "[System] Configuration reloaded"
				}
			case "m":
				cmds = append(cmds, m.discoverTools())
				m.logChan <- "[MCP] Refreshing tools..."
			case "x":
				if m.reactEngine != nil {
					m.reactEngine.ClearHistory()
					m.logs = append(m.logs, "[System] Conversation history cleared")
					m.viewport.SetContent(strings.Join(m.logs, "\n"))
					m.viewport.GotoBottom()
				}
			case "ctrl+f":
				m.showSearch = !m.showSearch
				m.showFilter = false
				cmd = m.searchBar.Toggle()
				cmds = append(cmds, cmd)
			case "ctrl+g":
				m.showFilter = !m.showFilter
				m.showSearch = false
				cmd = m.filterBar.Toggle()
				cmds = append(cmds, cmd)
			case "p":
				m.showPlugins = true
				m.activePlugin = 0
			case "ctrl+m":
				m.showMetrics = !m.showMetrics
			case "g":
				m.showGit = !m.showGit
				if m.showGit && m.gitClient != nil {
					m.gitStatus, _ = m.gitClient.Status()
				}
			case "R":
				m.showRemotes = !m.showRemotes
				m.activeRemote = 0
			case "M":
				m.showMarket = !m.showMarket
				if m.showMarket && m.market.NeedsSync() {
					m.market.Sync()
				}
				if m.showMarket {
					m.marketResults = m.market.ListFeatured()
					m.activeMarketItem = 0
				}
			case "P":
				m.showProviders = !m.showProviders
				if m.showProviders && m.llmBridge != nil {
					providers := m.llmBridge.ListProviders()
					if m.activeProviderIdx >= 0 && m.activeProviderIdx < len(providers) {
						m.providerModels = providers[m.activeProviderIdx].Models
					}
					m.activeModelIdx = 0
				}
			case "V":
				if m.voiceEnabled {
					if m.voiceInput.IsListening() {
						result, err := m.voiceInput.StopListening()
						if err == nil && result.Text != "" {
							m.textInput.SetValue(result.Text)
							m.logs = append(m.logs, fmt.Sprintf("[Voice] %s", result.Text))
						}
					} else {
						m.voiceInput.StartListening(m.ctx)
						m.logs = append(m.logs, "[Voice] Listening...")
					}
				}
			case "W":
				if m.webEnabled && m.webServer != nil {
					if m.webServer.IsRunning() {
						m.webServer.Stop()
						m.logs = append(m.logs, "[Web] Server stopped")
					} else {
						m.webServer.SetConfig(m.cfg)
						m.webServer.SetRunner(m.runner)
						m.webServer.SetSessionManager(m.sessionMgr)
						m.webServer.SetMetricsCollector(m.metricsCollector)
						if err := m.webServer.Start(); err != nil {
							m.logs = append(m.logs, fmt.Sprintf("[Web] Failed: %v", err))
						} else {
							m.logs = append(m.logs, fmt.Sprintf("[Web] Server at %s", m.webServer.Address()))
						}
					}
				}
			}
		}

	case components.SpinnerTickMsg:
		if m.processing {
			m.spinner, cmd = m.spinner.Update(msg)
			cmds = append(cmds, cmd)
		}

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

		sidebarWidth := 30
		m.viewport.Width = msg.Width - sidebarWidth - 6
		m.viewport.Height = msg.Height - 12
		m.textInput.Width = msg.Width - sidebarWidth - 10
	}

	m.viewport, cmd = m.viewport.Update(msg)
	cmds = append(cmds, cmd)

	return m, tea.Batch(cmds...)
}

func (m DashboardModel) View() string {
	if m.width == 0 {
		return "Initializing Dashboard..."
	}

	// Session list overlay
	if m.showSessions {
		return m.renderSessionList()
	}

	if m.showPlugins {
		return m.renderPluginList()
	}

	if m.showMetrics {
		return m.renderMetricsOverlay()
	}

	if m.showGit {
		return m.renderGitOverlay()
	}

	if m.showRemotes {
		return m.renderRemotesOverlay()
	}

	if m.showMarket {
		return m.renderMarketOverlay()
	}

	if m.showProviders {
		return m.renderProviderOverlay()
	}

	var sb strings.Builder

	// Session info at top
	sessionHeader := "SESSION"
	sessionIcon := lipgloss.NewStyle().Foreground(info).Render("◉")
	sb.WriteString(sectionStyle.Render(sessionHeader) + " " + sessionIcon + "\n")
	if m.currentSession != nil {
		sessionName := m.currentSession.Metadata.Name
		if len(sessionName) > 16 {
			sessionName = sessionName[:14] + ".."
		}
		sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render(
			fmt.Sprintf("  %s\n", sessionName)))
		sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render(
			fmt.Sprintf("  Msgs: %d\n", len(m.currentSession.Messages))))
	}
	sb.WriteString("\n")

	agentHeader := "AGENTS"
	if m.focus == FocusAgents {
		agentHeader = "► AGENTS"
	}
	sb.WriteString(sectionStyle.Render(agentHeader) + "\n\n")

	for i, ae := range m.agents {
		statusIcon := lipgloss.NewStyle().Foreground(ae.Status.Color()).Render(ae.Status.String())
		name := ae.Config.Name

		style := lipgloss.NewStyle().PaddingLeft(1)
		if i == m.activeAgent && m.focus == FocusAgents {
			style = style.Foreground(highlight).Bold(true)
			sb.WriteString(fmt.Sprintf("%s > %s\n", statusIcon, style.Render(name)))
		} else {
			sb.WriteString(fmt.Sprintf("%s   %s\n", statusIcon, style.Render(name)))
		}
	}

	sb.WriteString("\n")
	toolHeader := "MCP TOOLS"
	if m.focus == FocusTools {
		toolHeader = "► MCP TOOLS"
	}
	hubStatus := lipgloss.NewStyle().Foreground(danger).Render(" ✗")
	if m.hubConnected {
		hubStatus = lipgloss.NewStyle().Foreground(success).Render(" ●")
	}
	sb.WriteString(sectionStyle.Render(toolHeader) + hubStatus + "\n\n")

	if len(m.tools) == 0 {
		sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("  No tools discovered\n"))
	} else {
		maxTools := 4
		displayTools := m.tools
		if len(displayTools) > maxTools {
			displayTools = displayTools[:maxTools]
		}
		for i, tool := range displayTools {
			style := lipgloss.NewStyle().PaddingLeft(1)
			toolIcon := lipgloss.NewStyle().Foreground(info).Render("◆")
			if i == m.activeTool && m.focus == FocusTools {
				style = style.Foreground(highlight).Bold(true)
				sb.WriteString(fmt.Sprintf("%s > %s\n", toolIcon, style.Render(tool.Name)))
			} else {
				sb.WriteString(fmt.Sprintf("%s   %s\n", toolIcon, style.Render(tool.Name)))
			}
		}
		if len(m.tools) > maxTools {
			sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render(
				fmt.Sprintf("  ... +%d more\n", len(m.tools)-maxTools)))
		}
	}

	sb.WriteString("\n")
	llmHeader := "LLM"
	llmStatus := lipgloss.NewStyle().Foreground(danger).Render(" ✗")
	if m.llmReady {
		llmStatus = lipgloss.NewStyle().Foreground(success).Render(" ●")
	}
	sb.WriteString(sectionStyle.Render(llmHeader) + llmStatus + "\n")
	if m.llmReady {
		sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render(
			fmt.Sprintf("  %s\n", m.llmProvider.Model())))
		sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render(
			fmt.Sprintf("  Tokens: %d\n", m.totalUsage.TotalTokens)))
	}

	sb.WriteString("\n")
	provHeader := "PROVIDERS"
	provCount := len(m.cfg.Providers.Providers)
	enabledCount := 0
	for _, p := range m.cfg.Providers.Providers {
		if p.Enabled {
			enabledCount++
		}
	}
	provStatus := lipgloss.NewStyle().Foreground(subtle).Render(fmt.Sprintf(" (%d/%d)", enabledCount, provCount))
	sb.WriteString(sectionStyle.Render(provHeader) + provStatus + "\n")
	for _, p := range m.cfg.Providers.Providers {
		var icon string
		if p.Enabled {
			icon = lipgloss.NewStyle().Foreground(success).Render("●")
		} else {
			icon = lipgloss.NewStyle().Foreground(subtle).Render("○")
		}
		name := p.Name
		if len(name) > 12 {
			name = name[:10] + ".."
		}
		sb.WriteString(fmt.Sprintf("  %s %s\n", icon, name))
	}
	sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render(
		fmt.Sprintf("  Strategy: %s\n", m.cfg.Providers.Routing.Strategy)))

	sb.WriteString("\n")
	poolHeader := "AGENT POOL"
	poolStatus := lipgloss.NewStyle().Foreground(danger).Render(" ✗")
	if m.poolReady {
		poolStatus = lipgloss.NewStyle().Foreground(success).Render(" ●")
	}
	sb.WriteString(sectionStyle.Render(poolHeader) + poolStatus + "\n")
	if m.poolReady && m.agentPool != nil {
		stats := m.agentPool.Stats()
		sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render(
			fmt.Sprintf("  Agents: %d\n", stats.TotalAgents)))
		sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render(
			fmt.Sprintf("  Working: %d\n", stats.WorkingAgents)))
		sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render(
			fmt.Sprintf("  Tasks: %d\n", stats.TotalActiveTasks)))
	}

	sb.WriteString("\n")
	loopHeader := "AGENT LOOP"
	loopEnabled := m.cfg.AgentLoop.Enabled
	loopStatus := lipgloss.NewStyle().Foreground(subtle).Render(" ○")
	if loopEnabled {
		loopStatus = lipgloss.NewStyle().Foreground(success).Render(" ●")
	}
	sb.WriteString(sectionStyle.Render(loopHeader) + loopStatus + "\n")
	if loopEnabled {
		sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render(
			fmt.Sprintf("  Mode: %s\n", m.cfg.AgentLoop.ApprovalMode)))
		sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render(
			fmt.Sprintf("  Persona: %s\n", m.cfg.AgentLoop.DefaultPersona)))
	} else {
		sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("  Disabled\n"))
	}

	sb.WriteString("\n")
	pluginHeader := "PLUGINS"
	plugins := m.pluginMgr.List()
	pluginCount := len(plugins)
	pluginStatus := lipgloss.NewStyle().Foreground(subtle).Render(fmt.Sprintf(" (%d)", pluginCount))
	sb.WriteString(sectionStyle.Render(pluginHeader) + pluginStatus + "\n")
	if pluginCount == 0 {
		sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("  p to manage\n"))
	} else {
		activeCount := 0
		loadedCount := 0
		errorCount := 0
		for _, p := range plugins {
			switch p.State {
			case plugin.PluginStateActive:
				activeCount++
			case plugin.PluginStateLoaded:
				loadedCount++
			case plugin.PluginStateError:
				errorCount++
			}
		}
		if activeCount > 0 {
			sb.WriteString(lipgloss.NewStyle().Foreground(success).Render(
				fmt.Sprintf("  ● %d active\n", activeCount)))
		}
		if loadedCount > 0 {
			sb.WriteString(lipgloss.NewStyle().Foreground(info).Render(
				fmt.Sprintf("  ○ %d loaded\n", loadedCount)))
		}
		if errorCount > 0 {
			sb.WriteString(lipgloss.NewStyle().Foreground(danger).Render(
				fmt.Sprintf("  ✗ %d error\n", errorCount)))
		}
		if m.cfg.Plugin.HotReload {
			sb.WriteString(lipgloss.NewStyle().Foreground(warning).Render("  ↻ hot-reload\n"))
		}
		sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("  p to manage\n"))
	}

	sb.WriteString("\n")
	ctxHeader := "CONTEXT"
	ctxStatus := lipgloss.NewStyle().Foreground(success).Render(" ●")
	sb.WriteString(sectionStyle.Render(ctxHeader) + ctxStatus + "\n")
	ctxTokens := m.cfg.Context.TokenBudget
	ctxUsed := 0
	ctxMemEntries := 0
	if m.cfg.Context.MemorySettings.Enabled {
		ctxMemEntries = m.cfg.Context.MemorySettings.MaxEntries
	}
	sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render(
		fmt.Sprintf("  Budget: %dk\n", ctxTokens/1000)))
	sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render(
		fmt.Sprintf("  Used: %d\n", ctxUsed)))
	sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render(
		fmt.Sprintf("  Memory: %d max\n", ctxMemEntries)))

	sb.WriteString("\n")
	mcpServersHeader := "MCP SERVERS"
	if m.mcpAggregator != nil {
		statuses := m.mcpAggregator.ServerStatuses()
		serverCount := len(statuses)
		readyCount := 0
		for _, s := range statuses {
			if s.State == mcp.StateReady {
				readyCount++
			}
		}
		mcpServerStatus := lipgloss.NewStyle().Foreground(subtle).Render(fmt.Sprintf(" (%d)", serverCount))
		sb.WriteString(sectionStyle.Render(mcpServersHeader) + mcpServerStatus + "\n")
		if serverCount == 0 {
			sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("  No servers configured\n"))
		} else {
			maxDisplay := 3
			displayed := 0
			for _, s := range statuses {
				if displayed >= maxDisplay {
					break
				}
				var stateIcon string
				var stateColor lipgloss.AdaptiveColor
				switch s.State {
				case mcp.StateReady:
					stateIcon = "●"
					stateColor = success
				case mcp.StateConnecting, mcp.StateInitializing:
					stateIcon = "◐"
					stateColor = warning
				case mcp.StateError:
					stateIcon = "✗"
					stateColor = danger
				default:
					stateIcon = "○"
					stateColor = subtle
				}
				icon := lipgloss.NewStyle().Foreground(stateColor).Render(stateIcon)
				name := s.Name
				if len(name) > 12 {
					name = name[:10] + ".."
				}
				sb.WriteString(fmt.Sprintf("  %s %s\n", icon, name))
				displayed++
			}
			if serverCount > maxDisplay {
				sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render(
					fmt.Sprintf("  +%d more\n", serverCount-maxDisplay)))
			}
			sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render(
				fmt.Sprintf("  Ready: %d/%d\n", readyCount, serverCount)))
		}
	} else {
		sb.WriteString(sectionStyle.Render(mcpServersHeader) + lipgloss.NewStyle().Foreground(danger).Render(" ✗\n"))
	}

	sb.WriteString("\n")
	gitHeader := "GIT"
	if m.gitClient != nil && m.gitClient.IsRepo() {
		status, err := m.gitClient.Status()
		if err == nil {
			stagedCount := len(status.Staged)
			unstagedCount := len(status.Unstaged)
			untrackedCount := len(status.Untracked)

			branchStyle := lipgloss.NewStyle().Foreground(highlight)
			sb.WriteString(sectionStyle.Render(gitHeader) + "\n")
			sb.WriteString(branchStyle.Render(fmt.Sprintf("  ⎇ %s", status.Branch)))

			if stagedCount > 0 || unstagedCount > 0 || untrackedCount > 0 {
				sb.WriteString(lipgloss.NewStyle().Foreground(warning).Render(" ✗\n"))
			} else {
				sb.WriteString(lipgloss.NewStyle().Foreground(success).Render(" ●\n"))
			}

			if status.Ahead > 0 || status.Behind > 0 {
				syncInfo := ""
				if status.Ahead > 0 {
					syncInfo += fmt.Sprintf("↑%d ", status.Ahead)
				}
				if status.Behind > 0 {
					syncInfo += fmt.Sprintf("↓%d", status.Behind)
				}
				sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render(fmt.Sprintf("  %s\n", syncInfo)))
			}

			if stagedCount > 0 {
				sb.WriteString(lipgloss.NewStyle().Foreground(success).Render(fmt.Sprintf("  +%d staged\n", stagedCount)))
			}
			if unstagedCount > 0 {
				sb.WriteString(lipgloss.NewStyle().Foreground(warning).Render(fmt.Sprintf("  ~%d modified\n", unstagedCount)))
			}
			if untrackedCount > 0 {
				sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render(fmt.Sprintf("  ?%d untracked\n", untrackedCount)))
			}
			sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("  g for details\n"))
		} else {
			sb.WriteString(sectionStyle.Render(gitHeader) + lipgloss.NewStyle().Foreground(danger).Render(" ✗\n"))
		}
	} else {
		sb.WriteString(sectionStyle.Render(gitHeader) + lipgloss.NewStyle().Foreground(subtle).Render(" (no repo)\n"))
	}

	sb.WriteString("\n" + lipgloss.NewStyle().Foreground(subtle).Render("─────────────────────") + "\n")
	sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("^S save  ^L load  ^N new") + "\n")
	sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("/ or c  chat mode") + "\n")
	sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("tab switch  s/↵ run") + "\n")
	sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("ctrl+p parallel task") + "\n")

	chatModes := ""
	if m.useStreaming {
		chatModes += "S"
	}
	if m.useReAct {
		chatModes += "R"
	}
	if chatModes != "" {
		sb.WriteString(lipgloss.NewStyle().Foreground(highlight).Render(fmt.Sprintf("Chat: [%s] ", chatModes)))
		sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("^s/^r\n"))
	} else {
		sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("^s stream  ^r react") + "\n")
	}

	sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("x clear  r reload  q quit") + "\n")

	sidebar := sidebarStyle.Height(m.height - 6).Render(sb.String())

	tabBarView := m.tabBar.View()

	viewportContent := m.viewport.View()
	if m.showSearch {
		viewportContent = m.searchBar.HighlightContent(viewportContent)
	}

	content := tabBarView + "\n" + mainStyle.Width(m.width-35).Render(viewportContent)

	searchFilterBar := ""
	if m.showSearch {
		searchFilterBar = m.searchBar.View() + "\n"
	}
	if m.showFilter {
		searchFilterBar += m.filterBar.View() + "\n"
	}

	chatInput := ""
	if m.focus == FocusChat {
		chatInput = "\n" + inputStyle.Width(m.width-35).Render(m.textInput.View())
	} else {
		hint := lipgloss.NewStyle().Foreground(subtle).Render("Press / or c to chat, ctrl+f search, ctrl+g filter...")
		chatInput = "\n" + hint
	}

	spinnerView := ""
	if m.spinner.IsRunning() {
		spinnerView = m.spinner.View() + " "
	}

	mainContent := searchFilterBar + content + chatInput

	body := lipgloss.JoinHorizontal(lipgloss.Top, sidebar, mainContent)

	var selected string
	if m.focus == FocusAgents && m.activeAgent >= 0 && m.activeAgent < len(m.agents) {
		selected = "Agent: " + m.agents[m.activeAgent].Config.Name
	} else if m.focus == FocusTools && m.activeTool >= 0 && m.activeTool < len(m.tools) {
		selected = "Tool: " + m.tools[m.activeTool].Name
	} else if m.focus == FocusChat {
		selected = "Chat Mode"
		if m.processing {
			selected += " (processing...)"
		}
	} else {
		selected = "None"
	}

	statusKey := statusStyle.Render("SUPERAI")
	statusVal := statusText.Copy().
		Width(m.width - lipgloss.Width(statusKey) - lipgloss.Width(infoStyle.Render("v1.1.0")) - lipgloss.Width(spinnerView) - 4).
		Render("Mecha Suit Active | " + selected)
	infoLabel := infoStyle.Render("v2.1.0")
	status := lipgloss.JoinHorizontal(lipgloss.Top, statusKey, spinnerView, statusVal, infoLabel)

	return docStyle.Render(body + "\n" + status)
}

func (m DashboardModel) renderSessionList() string {
	var sb strings.Builder

	title := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#FFFDF5")).
		Background(lipgloss.Color("#7D56F4")).
		Padding(0, 2).
		Render("SAVED SESSIONS")

	sb.WriteString("\n" + title + "\n\n")

	if len(m.sessionList) == 0 {
		sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("  No saved sessions found.\n"))
		sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("  Use Ctrl+S to save current session.\n"))
	} else {
		for i, s := range m.sessionList {
			name := s.Name
			if len(name) > 30 {
				name = name[:28] + ".."
			}
			dateStr := s.UpdatedAt.Format("Jan 02 15:04")
			msgCount := fmt.Sprintf("%d msgs", s.MessageCount)

			style := lipgloss.NewStyle().PaddingLeft(2)
			if i == m.activeSession {
				style = style.Foreground(highlight).Bold(true)
				sb.WriteString(fmt.Sprintf("  > %-30s %s  %s\n", style.Render(name), dateStr, msgCount))
			} else {
				sb.WriteString(fmt.Sprintf("    %-30s %s  %s\n", style.Render(name), dateStr, msgCount))
			}
		}
	}

	sb.WriteString("\n")
	sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("  ↑/↓ navigate  Enter load  d delete  Esc close\n"))

	return docStyle.Render(sb.String())
}

func (m DashboardModel) renderPluginList() string {
	var sb strings.Builder

	title := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#FFFDF5")).
		Background(lipgloss.Color("#7D56F4")).
		Padding(0, 2).
		Render("PLUGINS")

	sb.WriteString("\n" + title + "\n\n")

	plugins := m.pluginMgr.List()
	if len(plugins) == 0 {
		sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("  No plugins found.\n"))
		sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("  Place .so/.dll/.dylib files in ~/.superai/plugins/\n"))
	} else {
		for i, p := range plugins {
			name := p.Info.Name
			if len(name) > 20 {
				name = name[:18] + ".."
			}
			version := p.Info.Version
			stateStr := p.State.String()

			var stateIcon string
			switch p.State {
			case plugin.PluginStateActive:
				stateIcon = lipgloss.NewStyle().Foreground(success).Render("●")
			case plugin.PluginStateLoaded:
				stateIcon = lipgloss.NewStyle().Foreground(info).Render("○")
			case plugin.PluginStateError:
				stateIcon = lipgloss.NewStyle().Foreground(danger).Render("✗")
			default:
				stateIcon = lipgloss.NewStyle().Foreground(subtle).Render("○")
			}

			style := lipgloss.NewStyle().PaddingLeft(1)
			if i == m.activePlugin {
				style = style.Foreground(highlight).Bold(true)
				sb.WriteString(fmt.Sprintf("%s > %-20s %s  %s\n", stateIcon, style.Render(name), version, stateStr))
			} else {
				sb.WriteString(fmt.Sprintf("%s   %-20s %s  %s\n", stateIcon, style.Render(name), version, stateStr))
			}
		}
	}

	sb.WriteString("\n")
	sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("  ↑/↓ navigate  Enter start/stop  u unload  Esc close\n"))

	return docStyle.Render(sb.String())
}

func (m DashboardModel) renderMetricsOverlay() string {
	var sb strings.Builder

	title := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#FFFDF5")).
		Background(lipgloss.Color("#7D56F4")).
		Padding(0, 2).
		Render("METRICS DASHBOARD")

	sb.WriteString("\n" + title + "\n\n")

	if m.metricsCollector == nil {
		sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("  Metrics collector not initialized.\n"))
		sb.WriteString("\n")
		sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("  Esc close\n"))
		return docStyle.Render(sb.String())
	}

	stats := m.metricsCollector.Stats()

	sectionHeader := lipgloss.NewStyle().Bold(true).Foreground(info)
	valueStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#FFFDF5"))
	labelStyle := lipgloss.NewStyle().Foreground(subtle)

	sb.WriteString(sectionHeader.Render("SESSION OVERVIEW") + "\n")
	sb.WriteString(fmt.Sprintf("  %s %s\n", labelStyle.Render("Session ID:"), valueStyle.Render(stats.SessionID[:8]+"...")))
	sb.WriteString(fmt.Sprintf("  %s %s\n", labelStyle.Render("Started:"), valueStyle.Render(stats.StartTime.Format("Jan 02 15:04:05"))))
	sb.WriteString(fmt.Sprintf("  %s %s\n", labelStyle.Render("Duration:"), valueStyle.Render(time.Since(stats.StartTime).Truncate(time.Second).String())))
	sb.WriteString("\n")

	sb.WriteString(sectionHeader.Render("REQUEST STATS") + "\n")
	sb.WriteString(fmt.Sprintf("  %s %s\n", labelStyle.Render("Total Requests:"), valueStyle.Render(fmt.Sprintf("%d", stats.TotalRequests))))
	sb.WriteString(fmt.Sprintf("  %s %s\n", labelStyle.Render("Successful:"), lipgloss.NewStyle().Foreground(success).Render(fmt.Sprintf("%d", stats.SuccessCount))))
	sb.WriteString(fmt.Sprintf("  %s %s\n", labelStyle.Render("Failed:"), lipgloss.NewStyle().Foreground(danger).Render(fmt.Sprintf("%d", stats.ErrorCount))))
	sb.WriteString(fmt.Sprintf("  %s %s\n", labelStyle.Render("Success Rate:"), valueStyle.Render(fmt.Sprintf("%.1f%%", m.metricsCollector.SuccessRate()))))
	sb.WriteString(fmt.Sprintf("  %s %s\n", labelStyle.Render("Avg Duration:"), valueStyle.Render(stats.AvgDuration.Truncate(time.Millisecond).String())))
	sb.WriteString("\n")

	sb.WriteString(sectionHeader.Render("TOKEN USAGE") + "\n")
	sb.WriteString(fmt.Sprintf("  %s %s\n", labelStyle.Render("Input Tokens:"), valueStyle.Render(fmt.Sprintf("%d", stats.TotalTokens.InputTokens))))
	sb.WriteString(fmt.Sprintf("  %s %s\n", labelStyle.Render("Output Tokens:"), valueStyle.Render(fmt.Sprintf("%d", stats.TotalTokens.OutputTokens))))
	sb.WriteString(fmt.Sprintf("  %s %s\n", labelStyle.Render("Total Tokens:"), valueStyle.Render(fmt.Sprintf("%d", stats.TotalTokens.TotalTokens))))
	sb.WriteString("\n")

	sb.WriteString(sectionHeader.Render("COST ESTIMATE") + "\n")
	costStyle := lipgloss.NewStyle().Foreground(warning).Bold(true)
	sb.WriteString(fmt.Sprintf("  %s %s\n", labelStyle.Render("Total Cost:"), costStyle.Render(fmt.Sprintf("$%.4f", stats.TotalCost))))

	if len(stats.CostByProvider) > 0 {
		sb.WriteString("\n")
		sb.WriteString(sectionHeader.Render("COST BY PROVIDER") + "\n")
		for provider, cost := range stats.CostByProvider {
			sb.WriteString(fmt.Sprintf("  %s %s\n", labelStyle.Render(provider+":"), valueStyle.Render(fmt.Sprintf("$%.4f", cost))))
		}
	}

	if len(stats.TokensByModel) > 0 {
		sb.WriteString("\n")
		sb.WriteString(sectionHeader.Render("TOKENS BY MODEL") + "\n")
		for model, tokens := range stats.TokensByModel {
			sb.WriteString(fmt.Sprintf("  %s %s\n", labelStyle.Render(model+":"), valueStyle.Render(fmt.Sprintf("%d", tokens.TotalTokens))))
		}
	}

	recentReqs := m.metricsCollector.RecentRequests(5)
	if len(recentReqs) > 0 {
		sb.WriteString("\n")
		sb.WriteString(sectionHeader.Render("RECENT REQUESTS") + "\n")
		for _, req := range recentReqs {
			statusIcon := lipgloss.NewStyle().Foreground(success).Render("✓")
			if !req.Success {
				statusIcon = lipgloss.NewStyle().Foreground(danger).Render("✗")
			}
			sb.WriteString(fmt.Sprintf("  %s %s %s %s\n",
				statusIcon,
				labelStyle.Render(req.Model),
				valueStyle.Render(req.Duration.Truncate(time.Millisecond).String()),
				labelStyle.Render(fmt.Sprintf("$%.4f", req.Cost))))
		}
	}

	sb.WriteString("\n")
	sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("  Ctrl+M close  Updates in real-time\n"))

	return docStyle.Render(sb.String())
}

func (m DashboardModel) renderGitOverlay() string {
	var sb strings.Builder

	title := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#FFFDF5")).
		Background(lipgloss.Color("#F97316")).
		Padding(0, 2).
		Render("GIT STATUS")

	sb.WriteString("\n" + title + "\n\n")

	if m.gitClient == nil || !m.gitClient.IsRepo() {
		sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("  Not a git repository.\n"))
		sb.WriteString("\n")
		sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("  g close\n"))
		return docStyle.Render(sb.String())
	}

	status := m.gitStatus
	if status == nil {
		sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("  Loading git status...\n"))
		return docStyle.Render(sb.String())
	}

	sectionHeader := lipgloss.NewStyle().Bold(true).Foreground(info)
	valueStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#FFFDF5"))
	labelStyle := lipgloss.NewStyle().Foreground(subtle)
	addedStyle := lipgloss.NewStyle().Foreground(success)
	modifiedStyle := lipgloss.NewStyle().Foreground(warning)
	deletedStyle := lipgloss.NewStyle().Foreground(danger)
	untrackedStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#888888"))

	sb.WriteString(sectionHeader.Render("REPOSITORY") + "\n")
	sb.WriteString(fmt.Sprintf("  %s %s\n", labelStyle.Render("Branch:"), valueStyle.Render(status.Branch)))
	if status.Upstream != "" {
		sb.WriteString(fmt.Sprintf("  %s %s\n", labelStyle.Render("Upstream:"), valueStyle.Render(status.Upstream)))
		if status.Ahead > 0 || status.Behind > 0 {
			syncStatus := ""
			if status.Ahead > 0 {
				syncStatus += addedStyle.Render(fmt.Sprintf("↑%d", status.Ahead))
			}
			if status.Behind > 0 {
				if syncStatus != "" {
					syncStatus += " "
				}
				syncStatus += deletedStyle.Render(fmt.Sprintf("↓%d", status.Behind))
			}
			sb.WriteString(fmt.Sprintf("  %s %s\n", labelStyle.Render("Sync:"), syncStatus))
		}
	}
	sb.WriteString("\n")

	if status.LastCommit != nil {
		sb.WriteString(sectionHeader.Render("LAST COMMIT") + "\n")
		sb.WriteString(fmt.Sprintf("  %s %s\n", labelStyle.Render("Hash:"), valueStyle.Render(status.LastCommit.ShortHash)))
		sb.WriteString(fmt.Sprintf("  %s %s\n", labelStyle.Render("Author:"), valueStyle.Render(status.LastCommit.Author)))
		sb.WriteString(fmt.Sprintf("  %s %s\n", labelStyle.Render("Date:"), valueStyle.Render(status.LastCommit.Date.Format("Jan 02 15:04"))))
		msg := status.LastCommit.Message
		if len(msg) > 50 {
			msg = msg[:47] + "..."
		}
		sb.WriteString(fmt.Sprintf("  %s %s\n", labelStyle.Render("Message:"), valueStyle.Render(msg)))
		sb.WriteString("\n")
	}

	totalChanges := len(status.Staged) + len(status.Unstaged) + len(status.Untracked)
	sb.WriteString(sectionHeader.Render(fmt.Sprintf("CHANGES (%d)", totalChanges)) + "\n")

	if len(status.Staged) > 0 {
		sb.WriteString(fmt.Sprintf("  %s\n", addedStyle.Render(fmt.Sprintf("Staged (%d):", len(status.Staged)))))
		for i, f := range status.Staged {
			if i >= 5 {
				sb.WriteString(fmt.Sprintf("    %s\n", labelStyle.Render(fmt.Sprintf("... and %d more", len(status.Staged)-5))))
				break
			}
			icon := "M"
			style := modifiedStyle
			switch f.Status {
			case "added":
				icon = "A"
				style = addedStyle
			case "deleted":
				icon = "D"
				style = deletedStyle
			case "renamed":
				icon = "R"
				style = modifiedStyle
			}
			sb.WriteString(fmt.Sprintf("    %s %s\n", style.Render(icon), labelStyle.Render(f.Path)))
		}
	}

	if len(status.Unstaged) > 0 {
		sb.WriteString(fmt.Sprintf("  %s\n", modifiedStyle.Render(fmt.Sprintf("Modified (%d):", len(status.Unstaged)))))
		for i, f := range status.Unstaged {
			if i >= 5 {
				sb.WriteString(fmt.Sprintf("    %s\n", labelStyle.Render(fmt.Sprintf("... and %d more", len(status.Unstaged)-5))))
				break
			}
			icon := "M"
			style := modifiedStyle
			if f.Status == "deleted" {
				icon = "D"
				style = deletedStyle
			}
			sb.WriteString(fmt.Sprintf("    %s %s\n", style.Render(icon), labelStyle.Render(f.Path)))
		}
	}

	if len(status.Untracked) > 0 {
		sb.WriteString(fmt.Sprintf("  %s\n", untrackedStyle.Render(fmt.Sprintf("Untracked (%d):", len(status.Untracked)))))
		for i, f := range status.Untracked {
			if i >= 5 {
				sb.WriteString(fmt.Sprintf("    %s\n", labelStyle.Render(fmt.Sprintf("... and %d more", len(status.Untracked)-5))))
				break
			}
			sb.WriteString(fmt.Sprintf("    %s %s\n", untrackedStyle.Render("?"), labelStyle.Render(f.Path)))
		}
	}

	if totalChanges == 0 {
		sb.WriteString(fmt.Sprintf("  %s\n", addedStyle.Render("✓ Working tree clean")))
	}

	if status.HasConflicts {
		sb.WriteString("\n")
		sb.WriteString(fmt.Sprintf("  %s\n", deletedStyle.Bold(true).Render("⚠ MERGE CONFLICTS DETECTED")))
	}

	sb.WriteString("\n")
	sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("  g close  r refresh\n"))

	return docStyle.Render(sb.String())
}

func (m DashboardModel) renderRemotesOverlay() string {
	var sb strings.Builder

	titleStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(highlight).
		MarginBottom(1)

	sectionHeader := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#FFFFFF")).
		Background(lipgloss.Color("#5A5A5A")).
		Padding(0, 1)

	labelStyle := lipgloss.NewStyle().Foreground(subtle)
	valueStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#FFFFFF"))
	connectedStyle := lipgloss.NewStyle().Foreground(success)
	disconnectedStyle := lipgloss.NewStyle().Foreground(subtle)
	errorStyle := lipgloss.NewStyle().Foreground(danger)

	sb.WriteString(titleStyle.Render("╭─ REMOTE AGENTS ─╮") + "\n\n")

	hosts := m.remoteMgr.ListHosts()

	if len(hosts) == 0 {
		sb.WriteString(labelStyle.Render("  No remote hosts configured.\n\n"))
		sb.WriteString(labelStyle.Render("  Add hosts to ~/.superai/remotes.json\n"))
		sb.WriteString(labelStyle.Render("  or use 'a' to add interactively.\n\n"))

		sb.WriteString(sectionHeader.Render("SUPPORTED TYPES") + "\n")
		sb.WriteString(fmt.Sprintf("  %s %s\n", valueStyle.Render("ssh"), labelStyle.Render("- SSH connections")))
		sb.WriteString(fmt.Sprintf("  %s %s\n", valueStyle.Render("docker"), labelStyle.Render("- Docker containers")))
		sb.WriteString(fmt.Sprintf("  %s %s\n", valueStyle.Render("kubernetes"), labelStyle.Render("- Kubernetes pods")))
		sb.WriteString(fmt.Sprintf("  %s %s\n", valueStyle.Render("local"), labelStyle.Render("- Local execution")))
	} else {
		sb.WriteString(sectionHeader.Render(fmt.Sprintf("HOSTS (%d)", len(hosts))) + "\n\n")

		for i, host := range hosts {
			cursor := "  "
			if i == m.activeRemote {
				cursor = "► "
			}

			conn := m.remoteMgr.GetConnection(host.ID)
			var stateIcon string
			var stateStyle lipgloss.Style

			if conn != nil {
				switch conn.GetState() {
				case remote.StateConnected:
					stateIcon = "●"
					stateStyle = connectedStyle
				case remote.StateConnecting:
					stateIcon = "◐"
					stateStyle = labelStyle
				case remote.StateError:
					stateIcon = "✗"
					stateStyle = errorStyle
				default:
					stateIcon = "○"
					stateStyle = disconnectedStyle
				}
			} else {
				stateIcon = "○"
				stateStyle = disconnectedStyle
			}

			typeLabel := string(host.Type)
			hostInfo := ""
			switch host.Type {
			case remote.ConnectionSSH:
				if host.User != "" {
					hostInfo = fmt.Sprintf("%s@%s:%d", host.User, host.Host, host.Port)
				} else {
					hostInfo = fmt.Sprintf("%s:%d", host.Host, host.Port)
				}
			case remote.ConnectionDocker:
				hostInfo = host.Container
			case remote.ConnectionKubernetes:
				if host.Namespace != "" {
					hostInfo = fmt.Sprintf("%s/%s", host.Namespace, host.Pod)
				} else {
					hostInfo = host.Pod
				}
			case remote.ConnectionLocal:
				hostInfo = "localhost"
			}

			sb.WriteString(fmt.Sprintf("%s%s %s [%s]\n",
				cursor,
				stateStyle.Render(stateIcon),
				valueStyle.Render(host.Name),
				labelStyle.Render(typeLabel)))
			sb.WriteString(fmt.Sprintf("     %s\n", labelStyle.Render(hostInfo)))

			if conn != nil && conn.GetState() == remote.StateConnected {
				latency := conn.GetLatency()
				if latency > 0 {
					sb.WriteString(fmt.Sprintf("     %s\n", connectedStyle.Render(fmt.Sprintf("%.0fms", float64(latency.Microseconds())/1000))))
				}
			}
			sb.WriteString("\n")
		}
	}

	sb.WriteString("\n")
	sb.WriteString(sectionHeader.Render("ACTIONS") + "\n")
	sb.WriteString(fmt.Sprintf("  %s %s\n", valueStyle.Render("Enter"), labelStyle.Render("- Connect/Execute")))
	sb.WriteString(fmt.Sprintf("  %s %s\n", valueStyle.Render("a"), labelStyle.Render("- Add host")))
	sb.WriteString(fmt.Sprintf("  %s %s\n", valueStyle.Render("d"), labelStyle.Render("- Disconnect")))
	sb.WriteString(fmt.Sprintf("  %s %s\n", valueStyle.Render("x"), labelStyle.Render("- Remove host")))
	sb.WriteString(fmt.Sprintf("  %s %s\n", valueStyle.Render("p"), labelStyle.Render("- Ping host")))
	sb.WriteString(fmt.Sprintf("  %s %s\n", valueStyle.Render("R/Esc"), labelStyle.Render("- Close overlay")))

	return docStyle.Render(sb.String())
}

func (m DashboardModel) renderMarketOverlay() string {
	var sb strings.Builder

	titleStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(highlight).
		MarginBottom(1)

	sectionHeader := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#FFFFFF")).
		Background(lipgloss.Color("#5A5A5A")).
		Padding(0, 1)

	labelStyle := lipgloss.NewStyle().Foreground(subtle)
	valueStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#FFFFFF"))
	installedStyle := lipgloss.NewStyle().Foreground(success)
	featuredStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#FFD700"))
	verifiedStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#00BFFF"))

	sb.WriteString(titleStyle.Render("╭─ PLUGIN MARKETPLACE ─╮") + "\n\n")

	stats := m.market.Stats()
	sb.WriteString(fmt.Sprintf("  %s %d  %s %d  %s %d\n\n",
		labelStyle.Render("Available:"), stats.TotalAvailable,
		installedStyle.Render("Installed:"), stats.InstalledCount,
		featuredStyle.Render("Updates:"), stats.UpdatesAvailable))

	if len(m.marketResults) == 0 {
		sb.WriteString(labelStyle.Render("  No plugins found. Press 's' to sync registry.\n"))
	} else {
		sb.WriteString(sectionHeader.Render(fmt.Sprintf("PLUGINS (%d)", len(m.marketResults))) + "\n\n")

		displayCount := 10
		if len(m.marketResults) < displayCount {
			displayCount = len(m.marketResults)
		}

		for i := 0; i < displayCount; i++ {
			plugin := m.marketResults[i]
			cursor := "  "
			if i == m.activeMarketItem {
				cursor = "► "
			}

			nameStyle := valueStyle
			badges := ""
			if plugin.Featured {
				badges += featuredStyle.Render(" ★")
			}
			if plugin.Verified {
				badges += verifiedStyle.Render(" ✓")
			}
			if m.market.IsInstalled(plugin.ID) {
				badges += installedStyle.Render(" [installed]")
				if m.market.HasUpdate(plugin.ID) {
					badges += featuredStyle.Render(" [update]")
				}
			}

			sb.WriteString(fmt.Sprintf("%s%s%s\n", cursor, nameStyle.Render(plugin.Name), badges))
			sb.WriteString(fmt.Sprintf("     %s\n", labelStyle.Render(plugin.Description)))
			sb.WriteString(fmt.Sprintf("     %s v%s  ↓%d  ★%d\n\n",
				labelStyle.Render(plugin.Author),
				plugin.Version,
				plugin.Downloads,
				plugin.Stars))
		}
	}

	categories := m.market.GetCategories()
	if len(categories) > 0 {
		sb.WriteString(sectionHeader.Render("CATEGORIES") + "\n")
		for _, cat := range categories {
			sb.WriteString(fmt.Sprintf("  %s\n", labelStyle.Render(cat)))
		}
		sb.WriteString("\n")
	}

	sb.WriteString(sectionHeader.Render("ACTIONS") + "\n")
	sb.WriteString(fmt.Sprintf("  %s %s\n", valueStyle.Render("Enter"), labelStyle.Render("- Install/Update")))
	sb.WriteString(fmt.Sprintf("  %s %s\n", valueStyle.Render("/"), labelStyle.Render("- Search plugins")))
	sb.WriteString(fmt.Sprintf("  %s %s\n", valueStyle.Render("s"), labelStyle.Render("- Sync registry")))
	sb.WriteString(fmt.Sprintf("  %s %s\n", valueStyle.Render("u"), labelStyle.Render("- Update all")))
	sb.WriteString(fmt.Sprintf("  %s %s\n", valueStyle.Render("x"), labelStyle.Render("- Uninstall")))
	sb.WriteString(fmt.Sprintf("  %s %s\n", valueStyle.Render("f"), labelStyle.Render("- Featured only")))
	sb.WriteString(fmt.Sprintf("  %s %s\n", valueStyle.Render("i"), labelStyle.Render("- Installed only")))
	sb.WriteString(fmt.Sprintf("  %s %s\n", valueStyle.Render("M/Esc"), labelStyle.Render("- Close overlay")))

	return docStyle.Render(sb.String())
}

func (m DashboardModel) renderProviderOverlay() string {
	var sb strings.Builder

	title := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#FFFDF5")).
		Background(lipgloss.Color("#7D56F4")).
		Padding(0, 2).
		Render("LLM PROVIDERS")

	sb.WriteString("\n" + title + "\n\n")

	if m.llmBridge == nil {
		sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("  LLM Bridge not initialized.\n"))
		sb.WriteString("\n")
		sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("  Esc close\n"))
		return docStyle.Render(sb.String())
	}

	providers := m.llmBridge.ListProviders()
	if len(providers) == 0 {
		sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("  No providers configured.\n"))
		sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("  Add providers in ~/.superai/config.yaml\n"))
	} else {
		sectionHeader := lipgloss.NewStyle().Bold(true).Foreground(info)
		sb.WriteString(sectionHeader.Render("AVAILABLE PROVIDERS") + "\n\n")

		for i, p := range providers {
			var statusIcon string
			if p.Healthy {
				statusIcon = lipgloss.NewStyle().Foreground(success).Render("●")
			} else if p.Enabled {
				statusIcon = lipgloss.NewStyle().Foreground(warning).Render("○")
			} else {
				statusIcon = lipgloss.NewStyle().Foreground(subtle).Render("○")
			}

			name := p.Name
			if len(name) > 15 {
				name = name[:13] + ".."
			}
			typeStr := string(p.Type)

			style := lipgloss.NewStyle().PaddingLeft(1)
			cursor := "  "
			if i == m.activeProviderIdx {
				cursor = "► "
				style = style.Foreground(highlight).Bold(true)
			}

			activeMark := ""
			if m.llmBridge.GetActiveProvider() == p.Name {
				activeMark = lipgloss.NewStyle().Foreground(success).Render(" [active]")
			}

			sb.WriteString(fmt.Sprintf("%s%s %-15s  %s%s\n", cursor, statusIcon, style.Render(name), typeStr, activeMark))

			if i == m.activeProviderIdx && len(p.Models) > 0 {
				sb.WriteString("\n")
				modelHeader := lipgloss.NewStyle().Foreground(subtle).Italic(true)
				sb.WriteString(modelHeader.Render("     Models:") + "\n")
				for j, model := range p.Models {
					modelCursor := "      "
					modelStyle := lipgloss.NewStyle().Foreground(subtle)
					if j == m.activeModelIdx {
						modelCursor = "    ► "
						modelStyle = modelStyle.Foreground(highlight)
					}
					modelMark := ""
					if model == m.llmBridge.GetModel() {
						modelMark = lipgloss.NewStyle().Foreground(success).Render(" ✓")
					}
					sb.WriteString(fmt.Sprintf("%s%s%s\n", modelCursor, modelStyle.Render(model), modelMark))
				}
				sb.WriteString("\n")
			}
		}
	}

	sb.WriteString("\n")
	labelStyle := lipgloss.NewStyle().Foreground(subtle)
	valueStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#FFFFFF"))

	sb.WriteString(lipgloss.NewStyle().Bold(true).Foreground(info).Render("CURRENT") + "\n")
	currentProvider := m.llmBridge.GetActiveProvider()
	currentModel := m.llmBridge.GetModel()
	if currentProvider == "" {
		currentProvider = "(none)"
	}
	if currentModel == "" {
		currentModel = "(default)"
	}
	sb.WriteString(fmt.Sprintf("  %s %s\n", labelStyle.Render("Provider:"), valueStyle.Render(currentProvider)))
	sb.WriteString(fmt.Sprintf("  %s %s\n", labelStyle.Render("Model:"), valueStyle.Render(currentModel)))
	sb.WriteString(fmt.Sprintf("  %s %s\n", labelStyle.Render("System:"), valueStyle.Render(func() string {
		if m.llmBridge.IsNewSystemEnabled() {
			return "new (multi-provider)"
		}
		return "legacy"
	}())))

	sb.WriteString("\n")
	sb.WriteString(lipgloss.NewStyle().Foreground(subtle).Render("  ↑/↓ provider  ←/→ model  Enter select  n toggle new system  P/Esc close\n"))

	return docStyle.Render(sb.String())
}
