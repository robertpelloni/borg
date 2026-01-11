package context

import (
	"context"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"sync"
)

type SlashCommand interface {
	Name() string
	Description() string
	Usage() string
	Execute(ctx context.Context, args string, focus *FocusChain) (*CommandResult, error)
}

type CommandResult struct {
	Output      string
	ContextItem *ContextItem
	Action      CommandAction
	Metadata    map[string]string
}

type CommandAction int

const (
	ActionNone CommandAction = iota
	ActionAddContext
	ActionReplaceContext
	ActionClearContext
	ActionExecuteTool
)

type CommandRegistry struct {
	commands map[string]SlashCommand
	aliases  map[string]string
	mu       sync.RWMutex
}

func NewCommandRegistry() *CommandRegistry {
	return &CommandRegistry{
		commands: make(map[string]SlashCommand),
		aliases:  make(map[string]string),
	}
}

func (cr *CommandRegistry) Register(cmd SlashCommand) {
	cr.mu.Lock()
	defer cr.mu.Unlock()
	cr.commands[cmd.Name()] = cmd
}

func (cr *CommandRegistry) RegisterAlias(alias, target string) {
	cr.mu.Lock()
	defer cr.mu.Unlock()
	cr.aliases[alias] = target
}

func (cr *CommandRegistry) Get(name string) (SlashCommand, bool) {
	cr.mu.RLock()
	defer cr.mu.RUnlock()

	if target, ok := cr.aliases[name]; ok {
		name = target
	}
	cmd, ok := cr.commands[name]
	return cmd, ok
}

func (cr *CommandRegistry) List() []SlashCommand {
	cr.mu.RLock()
	defer cr.mu.RUnlock()

	cmds := make([]SlashCommand, 0, len(cr.commands))
	for _, cmd := range cr.commands {
		cmds = append(cmds, cmd)
	}

	sort.Slice(cmds, func(i, j int) bool {
		return cmds[i].Name() < cmds[j].Name()
	})

	return cmds
}

func (cr *CommandRegistry) Parse(input string) (cmd SlashCommand, args string, ok bool) {
	if !strings.HasPrefix(input, "/") {
		return nil, "", false
	}

	input = strings.TrimPrefix(input, "/")
	parts := strings.SplitN(input, " ", 2)
	name := strings.ToLower(parts[0])

	if len(parts) > 1 {
		args = strings.TrimSpace(parts[1])
	}

	cmd, ok = cr.Get(name)
	return cmd, args, ok
}

func (cr *CommandRegistry) Execute(ctx context.Context, input string, focus *FocusChain) (*CommandResult, error) {
	cmd, args, ok := cr.Parse(input)
	if !ok {
		return nil, fmt.Errorf("unknown command: %s", input)
	}
	return cmd.Execute(ctx, args, focus)
}

type BaseCommand struct {
	name        string
	description string
	usage       string
}

func (bc *BaseCommand) Name() string        { return bc.name }
func (bc *BaseCommand) Description() string { return bc.description }
func (bc *BaseCommand) Usage() string       { return bc.usage }

type SummarizeCommand struct {
	BaseCommand
}

func NewSummarizeCommand() *SummarizeCommand {
	return &SummarizeCommand{
		BaseCommand: BaseCommand{
			name:        "summarize",
			description: "Summarize the current context or specified content",
			usage:       "/summarize [content or 'context']",
		},
	}
}

func (c *SummarizeCommand) Execute(ctx context.Context, args string, focus *FocusChain) (*CommandResult, error) {
	var content string
	if args == "" || args == "context" {
		content = focus.Build()
	} else {
		content = args
	}

	prompt := fmt.Sprintf(`Please provide a concise summary of the following content:

%s

Summary:`, content)

	return &CommandResult{
		Output: prompt,
		Action: ActionExecuteTool,
		Metadata: map[string]string{
			"tool":   "llm",
			"prompt": prompt,
		},
	}, nil
}

type TestCommand struct {
	BaseCommand
}

func NewTestCommand() *TestCommand {
	return &TestCommand{
		BaseCommand: BaseCommand{
			name:        "test",
			description: "Generate tests for specified code or file",
			usage:       "/test <file_path or code>",
		},
	}
}

func (c *TestCommand) Execute(ctx context.Context, args string, focus *FocusChain) (*CommandResult, error) {
	if args == "" {
		return nil, fmt.Errorf("test command requires a file path or code")
	}

	prompt := fmt.Sprintf(`Generate comprehensive unit tests for the following code. Include:
- Edge cases
- Error handling
- Happy path scenarios
- Use appropriate testing framework conventions

Code to test:
%s

Generated tests:`, args)

	return &CommandResult{
		Output: prompt,
		Action: ActionExecuteTool,
		Metadata: map[string]string{
			"tool":   "llm",
			"prompt": prompt,
		},
	}, nil
}

type DocCommand struct {
	BaseCommand
}

func NewDocCommand() *DocCommand {
	return &DocCommand{
		BaseCommand: BaseCommand{
			name:        "doc",
			description: "Generate documentation for code or API",
			usage:       "/doc <file_path or code> [format: markdown|jsdoc|godoc]",
		},
	}
}

func (c *DocCommand) Execute(ctx context.Context, args string, focus *FocusChain) (*CommandResult, error) {
	if args == "" {
		return nil, fmt.Errorf("doc command requires content to document")
	}

	format := "markdown"
	parts := strings.Split(args, " ")
	lastPart := strings.ToLower(parts[len(parts)-1])
	if lastPart == "markdown" || lastPart == "jsdoc" || lastPart == "godoc" {
		format = lastPart
		args = strings.Join(parts[:len(parts)-1], " ")
	}

	prompt := fmt.Sprintf(`Generate comprehensive documentation in %s format for the following code.
Include:
- Purpose and overview
- Parameters/arguments
- Return values
- Examples
- Any important notes or caveats

Code to document:
%s

Documentation:`, format, args)

	return &CommandResult{
		Output: prompt,
		Action: ActionExecuteTool,
		Metadata: map[string]string{
			"tool":   "llm",
			"prompt": prompt,
			"format": format,
		},
	}, nil
}

type RefactorCommand struct {
	BaseCommand
}

func NewRefactorCommand() *RefactorCommand {
	return &RefactorCommand{
		BaseCommand: BaseCommand{
			name:        "refactor",
			description: "Suggest refactoring improvements for code",
			usage:       "/refactor <file_path or code> [focus: performance|readability|maintainability]",
		},
	}
}

func (c *RefactorCommand) Execute(ctx context.Context, args string, focus *FocusChain) (*CommandResult, error) {
	if args == "" {
		return nil, fmt.Errorf("refactor command requires code to refactor")
	}

	focusArea := "general"
	parts := strings.Split(args, " ")
	lastPart := strings.ToLower(parts[len(parts)-1])
	if lastPart == "performance" || lastPart == "readability" || lastPart == "maintainability" {
		focusArea = lastPart
		args = strings.Join(parts[:len(parts)-1], " ")
	}

	prompt := fmt.Sprintf(`Analyze and suggest refactoring improvements for the following code.
Focus area: %s

Consider:
- Code smells and anti-patterns
- SOLID principles
- DRY (Don't Repeat Yourself)
- Performance optimizations
- Error handling improvements
- Better naming and structure

Code to refactor:
%s

Refactoring suggestions:`, focusArea, args)

	return &CommandResult{
		Output: prompt,
		Action: ActionExecuteTool,
		Metadata: map[string]string{
			"tool":   "llm",
			"prompt": prompt,
			"focus":  focusArea,
		},
	}, nil
}

type ExplainCommand struct {
	BaseCommand
}

func NewExplainCommand() *ExplainCommand {
	return &ExplainCommand{
		BaseCommand: BaseCommand{
			name:        "explain",
			description: "Explain code or concept in detail",
			usage:       "/explain <code or concept>",
		},
	}
}

func (c *ExplainCommand) Execute(ctx context.Context, args string, focus *FocusChain) (*CommandResult, error) {
	if args == "" {
		return nil, fmt.Errorf("explain command requires content to explain")
	}

	prompt := fmt.Sprintf(`Provide a detailed explanation of the following:

%s

Explanation:`, args)

	return &CommandResult{
		Output: prompt,
		Action: ActionExecuteTool,
		Metadata: map[string]string{
			"tool":   "llm",
			"prompt": prompt,
		},
	}, nil
}

type ReviewCommand struct {
	BaseCommand
}

func NewReviewCommand() *ReviewCommand {
	return &ReviewCommand{
		BaseCommand: BaseCommand{
			name:        "review",
			description: "Perform a code review",
			usage:       "/review <file_path or code>",
		},
	}
}

func (c *ReviewCommand) Execute(ctx context.Context, args string, focus *FocusChain) (*CommandResult, error) {
	if args == "" {
		return nil, fmt.Errorf("review command requires code to review")
	}

	prompt := fmt.Sprintf(`Perform a thorough code review of the following code.

Check for:
- Bugs and potential issues
- Security vulnerabilities
- Performance concerns
- Code style and conventions
- Error handling
- Edge cases
- Documentation

Code to review:
%s

Code Review:`, args)

	return &CommandResult{
		Output: prompt,
		Action: ActionExecuteTool,
		Metadata: map[string]string{
			"tool":   "llm",
			"prompt": prompt,
		},
	}, nil
}

type FixCommand struct {
	BaseCommand
}

func NewFixCommand() *FixCommand {
	return &FixCommand{
		BaseCommand: BaseCommand{
			name:        "fix",
			description: "Fix errors or issues in code",
			usage:       "/fix <error message or code with issue>",
		},
	}
}

func (c *FixCommand) Execute(ctx context.Context, args string, focus *FocusChain) (*CommandResult, error) {
	if args == "" {
		return nil, fmt.Errorf("fix command requires an error or issue description")
	}

	prompt := fmt.Sprintf(`Analyze and fix the following error or issue:

%s

Provide:
1. Root cause analysis
2. Fixed code
3. Explanation of the fix
4. Prevention tips

Fix:`, args)

	return &CommandResult{
		Output: prompt,
		Action: ActionExecuteTool,
		Metadata: map[string]string{
			"tool":   "llm",
			"prompt": prompt,
		},
	}, nil
}

type ClearCommand struct {
	BaseCommand
}

func NewClearCommand() *ClearCommand {
	return &ClearCommand{
		BaseCommand: BaseCommand{
			name:        "clear",
			description: "Clear context or specific layer",
			usage:       "/clear [layer: system|project|task|history|user|all]",
		},
	}
}

func (c *ClearCommand) Execute(ctx context.Context, args string, focus *FocusChain) (*CommandResult, error) {
	args = strings.ToLower(strings.TrimSpace(args))

	if args == "" || args == "all" {
		focus.Clear()
		return &CommandResult{
			Output: "All context cleared",
			Action: ActionClearContext,
		}, nil
	}

	layerMap := map[string]FocusLayer{
		"system":  LayerSystem,
		"project": LayerProject,
		"task":    LayerTask,
		"history": LayerHistory,
		"user":    LayerUser,
	}

	layer, ok := layerMap[args]
	if !ok {
		return nil, fmt.Errorf("unknown layer: %s", args)
	}

	focus.ClearLayer(layer)
	return &CommandResult{
		Output: fmt.Sprintf("Cleared %s layer", args),
		Action: ActionClearContext,
	}, nil
}

type StatsCommand struct {
	BaseCommand
}

func NewStatsCommand() *StatsCommand {
	return &StatsCommand{
		BaseCommand: BaseCommand{
			name:        "stats",
			description: "Show context statistics",
			usage:       "/stats",
		},
	}
}

func (c *StatsCommand) Execute(ctx context.Context, args string, focus *FocusChain) (*CommandResult, error) {
	stats := focus.Stats()

	var sb strings.Builder
	sb.WriteString("Context Statistics:\n")
	sb.WriteString(fmt.Sprintf("  Total Tokens: %v\n", stats["total_tokens"]))
	sb.WriteString(fmt.Sprintf("  Token Budget: %v\n", stats["token_budget"]))
	sb.WriteString(fmt.Sprintf("  Usage: %.1f%%\n", stats["usage"].(float64)*100))

	if layers, ok := stats["layers"].(map[string]map[string]int); ok {
		sb.WriteString("\nLayers:\n")
		for layer, info := range layers {
			sb.WriteString(fmt.Sprintf("  %s: %d items, %d tokens (budget: %d)\n",
				layer, info["items"], info["tokens"], info["budget"]))
		}
	}

	return &CommandResult{
		Output: sb.String(),
		Action: ActionNone,
	}, nil
}

type HelpCommand struct {
	BaseCommand
	registry *CommandRegistry
}

func NewHelpCommand(registry *CommandRegistry) *HelpCommand {
	return &HelpCommand{
		BaseCommand: BaseCommand{
			name:        "help",
			description: "Show available commands or help for specific command",
			usage:       "/help [command]",
		},
		registry: registry,
	}
}

func (c *HelpCommand) Execute(ctx context.Context, args string, focus *FocusChain) (*CommandResult, error) {
	if args != "" {
		cmd, ok := c.registry.Get(args)
		if !ok {
			return nil, fmt.Errorf("unknown command: %s", args)
		}
		output := fmt.Sprintf("/%s - %s\nUsage: %s", cmd.Name(), cmd.Description(), cmd.Usage())
		return &CommandResult{Output: output, Action: ActionNone}, nil
	}

	var sb strings.Builder
	sb.WriteString("Available Commands:\n\n")

	for _, cmd := range c.registry.List() {
		sb.WriteString(fmt.Sprintf("  /%s - %s\n", cmd.Name(), cmd.Description()))
	}

	sb.WriteString("\nUse /help <command> for detailed usage.")

	return &CommandResult{
		Output: sb.String(),
		Action: ActionNone,
	}, nil
}

type CustomCommand struct {
	BaseCommand
	template string
	params   []string
}

func NewCustomCommand(name, description, usage, template string) *CustomCommand {
	paramRegex := regexp.MustCompile(`\{(\w+)\}`)
	matches := paramRegex.FindAllStringSubmatch(template, -1)

	var params []string
	for _, match := range matches {
		params = append(params, match[1])
	}

	return &CustomCommand{
		BaseCommand: BaseCommand{
			name:        name,
			description: description,
			usage:       usage,
		},
		template: template,
		params:   params,
	}
}

func (c *CustomCommand) Execute(ctx context.Context, args string, focus *FocusChain) (*CommandResult, error) {
	prompt := c.template

	if len(c.params) > 0 {
		argParts := strings.Fields(args)
		for i, param := range c.params {
			var value string
			if i < len(argParts) {
				value = argParts[i]
			} else if i == len(c.params)-1 && len(argParts) > i {
				value = strings.Join(argParts[i:], " ")
			}
			prompt = strings.ReplaceAll(prompt, fmt.Sprintf("{%s}", param), value)
		}
	}

	if args != "" && len(c.params) == 0 {
		prompt = strings.ReplaceAll(prompt, "{input}", args)
	}

	return &CommandResult{
		Output: prompt,
		Action: ActionExecuteTool,
		Metadata: map[string]string{
			"tool":   "llm",
			"prompt": prompt,
		},
	}, nil
}

type CommandConfig struct {
	Name        string `yaml:"name"`
	Description string `yaml:"description"`
	Usage       string `yaml:"usage"`
	Template    string `yaml:"template"`
	Enabled     bool   `yaml:"enabled"`
}

func RegisterBuiltinCommands(registry *CommandRegistry) {
	registry.Register(NewSummarizeCommand())
	registry.Register(NewTestCommand())
	registry.Register(NewDocCommand())
	registry.Register(NewRefactorCommand())
	registry.Register(NewExplainCommand())
	registry.Register(NewReviewCommand())
	registry.Register(NewFixCommand())
	registry.Register(NewClearCommand())
	registry.Register(NewStatsCommand())
	registry.Register(NewHelpCommand(registry))

	registry.RegisterAlias("s", "summarize")
	registry.RegisterAlias("t", "test")
	registry.RegisterAlias("d", "doc")
	registry.RegisterAlias("r", "refactor")
	registry.RegisterAlias("e", "explain")
	registry.RegisterAlias("?", "help")
	registry.RegisterAlias("h", "help")
}

func LoadCustomCommands(registry *CommandRegistry, configs []CommandConfig) {
	for _, cfg := range configs {
		if !cfg.Enabled {
			continue
		}
		cmd := NewCustomCommand(cfg.Name, cfg.Description, cfg.Usage, cfg.Template)
		registry.Register(cmd)
	}
}
