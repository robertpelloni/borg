package providers

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	ctx "github.com/aios/superai-cli/internal/context"
)

type FileProvider struct {
	name string
}

func NewFileProvider(config ctx.ProviderConfig) (ctx.Provider, error) {
	name := config.Name
	if name == "" {
		name = "file"
	}
	return &FileProvider{name: name}, nil
}

func (p *FileProvider) Type() ctx.ProviderType { return ctx.ProviderFile }
func (p *FileProvider) Name() string           { return p.name }
func (p *FileProvider) Description() string    { return "Include contents of a file" }

func (p *FileProvider) Validate(args map[string]interface{}) error {
	if _, ok := args["path"]; !ok {
		return fmt.Errorf("path is required")
	}
	return nil
}

func (p *FileProvider) Fetch(c context.Context, args map[string]interface{}) (*ctx.ContextItem, error) {
	path, _ := args["path"].(string)

	content, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading file: %w", err)
	}

	return &ctx.ContextItem{
		ID:         fmt.Sprintf("file:%s", path),
		Type:       ctx.ProviderFile,
		Name:       filepath.Base(path),
		Content:    string(content),
		TokenCount: ctx.EstimateTokens(string(content)),
		Metadata:   map[string]string{"path": path},
	}, nil
}

type DiffProvider struct {
	name string
}

func NewDiffProvider(config ctx.ProviderConfig) (ctx.Provider, error) {
	name := config.Name
	if name == "" {
		name = "diff"
	}
	return &DiffProvider{name: name}, nil
}

func (p *DiffProvider) Type() ctx.ProviderType { return ctx.ProviderDiff }
func (p *DiffProvider) Name() string           { return p.name }
func (p *DiffProvider) Description() string    { return "Include git diff output" }

func (p *DiffProvider) Validate(args map[string]interface{}) error {
	return nil
}

func (p *DiffProvider) Fetch(c context.Context, args map[string]interface{}) (*ctx.ContextItem, error) {
	staged, _ := args["staged"].(bool)
	ref, _ := args["ref"].(string)

	var cmd *exec.Cmd
	if staged {
		cmd = exec.CommandContext(c, "git", "diff", "--cached")
	} else if ref != "" {
		cmd = exec.CommandContext(c, "git", "diff", ref)
	} else {
		cmd = exec.CommandContext(c, "git", "diff")
	}

	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("running git diff: %w", err)
	}

	diffType := "unstaged"
	if staged {
		diffType = "staged"
	} else if ref != "" {
		diffType = ref
	}

	return &ctx.ContextItem{
		ID:         fmt.Sprintf("diff:%s", diffType),
		Type:       ctx.ProviderDiff,
		Name:       fmt.Sprintf("Git Diff (%s)", diffType),
		Content:    string(output),
		TokenCount: ctx.EstimateTokens(string(output)),
		Metadata:   map[string]string{"type": diffType},
	}, nil
}

type TerminalProvider struct {
	name    string
	history []string
}

func NewTerminalProvider(config ctx.ProviderConfig) (ctx.Provider, error) {
	name := config.Name
	if name == "" {
		name = "terminal"
	}
	return &TerminalProvider{name: name, history: make([]string, 0)}, nil
}

func (p *TerminalProvider) Type() ctx.ProviderType { return ctx.ProviderTerminal }
func (p *TerminalProvider) Name() string           { return p.name }
func (p *TerminalProvider) Description() string    { return "Include terminal output" }

func (p *TerminalProvider) Validate(args map[string]interface{}) error {
	return nil
}

func (p *TerminalProvider) Fetch(c context.Context, args map[string]interface{}) (*ctx.ContextItem, error) {
	command, hasCmd := args["command"].(string)
	lines, _ := args["lines"].(int)
	if lines == 0 {
		lines = 50
	}

	var content string
	if hasCmd {
		cmd := exec.CommandContext(c, "sh", "-c", command)
		output, err := cmd.CombinedOutput()
		if err != nil {
			content = fmt.Sprintf("$ %s\n%s\nError: %v", command, string(output), err)
		} else {
			content = fmt.Sprintf("$ %s\n%s", command, string(output))
		}
		p.history = append(p.history, content)
	} else {
		if len(p.history) > lines {
			p.history = p.history[len(p.history)-lines:]
		}
		content = strings.Join(p.history, "\n---\n")
	}

	return &ctx.ContextItem{
		ID:         fmt.Sprintf("terminal:%d", time.Now().UnixNano()),
		Type:       ctx.ProviderTerminal,
		Name:       "Terminal Output",
		Content:    content,
		TokenCount: ctx.EstimateTokens(content),
	}, nil
}

func (p *TerminalProvider) AddOutput(output string) {
	p.history = append(p.history, output)
}

type HTTPProvider struct {
	name   string
	client *http.Client
}

func NewHTTPProvider(config ctx.ProviderConfig) (ctx.Provider, error) {
	name := config.Name
	if name == "" {
		name = "http"
	}
	timeout := 30 * time.Second
	if t, ok := config.Options["timeout"]; ok {
		if d, err := time.ParseDuration(t); err == nil {
			timeout = d
		}
	}
	return &HTTPProvider{
		name:   name,
		client: &http.Client{Timeout: timeout},
	}, nil
}

func (p *HTTPProvider) Type() ctx.ProviderType { return ctx.ProviderHTTP }
func (p *HTTPProvider) Name() string           { return p.name }
func (p *HTTPProvider) Description() string    { return "Fetch content from URL" }

func (p *HTTPProvider) Validate(args map[string]interface{}) error {
	if _, ok := args["url"]; !ok {
		return fmt.Errorf("url is required")
	}
	return nil
}

func (p *HTTPProvider) Fetch(c context.Context, args map[string]interface{}) (*ctx.ContextItem, error) {
	url, _ := args["url"].(string)

	req, err := http.NewRequestWithContext(c, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	return &ctx.ContextItem{
		ID:         fmt.Sprintf("http:%s", url),
		Type:       ctx.ProviderHTTP,
		Name:       url,
		Content:    string(body),
		TokenCount: ctx.EstimateTokens(string(body)),
		Metadata:   map[string]string{"url": url, "status": resp.Status},
	}, nil
}

type FolderProvider struct {
	name string
}

func NewFolderProvider(config ctx.ProviderConfig) (ctx.Provider, error) {
	name := config.Name
	if name == "" {
		name = "folder"
	}
	return &FolderProvider{name: name}, nil
}

func (p *FolderProvider) Type() ctx.ProviderType { return ctx.ProviderFolder }
func (p *FolderProvider) Name() string           { return p.name }
func (p *FolderProvider) Description() string    { return "Include directory structure" }

func (p *FolderProvider) Validate(args map[string]interface{}) error {
	if _, ok := args["path"]; !ok {
		return fmt.Errorf("path is required")
	}
	return nil
}

func (p *FolderProvider) Fetch(c context.Context, args map[string]interface{}) (*ctx.ContextItem, error) {
	path, _ := args["path"].(string)
	depth, _ := args["depth"].(int)
	if depth == 0 {
		depth = 3
	}

	var sb strings.Builder
	sb.WriteString(path + "/\n")
	p.walkDir(path, "", depth, &sb)

	content := sb.String()
	return &ctx.ContextItem{
		ID:         fmt.Sprintf("folder:%s", path),
		Type:       ctx.ProviderFolder,
		Name:       filepath.Base(path),
		Content:    content,
		TokenCount: ctx.EstimateTokens(content),
		Metadata:   map[string]string{"path": path},
	}, nil
}

func (p *FolderProvider) walkDir(path, prefix string, depth int, sb *strings.Builder) {
	if depth <= 0 {
		return
	}

	entries, err := os.ReadDir(path)
	if err != nil {
		return
	}

	for i, entry := range entries {
		if strings.HasPrefix(entry.Name(), ".") {
			continue
		}

		isLast := i == len(entries)-1
		connector := "├── "
		if isLast {
			connector = "└── "
		}

		sb.WriteString(prefix + connector + entry.Name())
		if entry.IsDir() {
			sb.WriteString("/")
		}
		sb.WriteString("\n")

		if entry.IsDir() {
			newPrefix := prefix + "│   "
			if isLast {
				newPrefix = prefix + "    "
			}
			p.walkDir(filepath.Join(path, entry.Name()), newPrefix, depth-1, sb)
		}
	}
}

type SearchProvider struct {
	name string
}

func NewSearchProvider(config ctx.ProviderConfig) (ctx.Provider, error) {
	name := config.Name
	if name == "" {
		name = "search"
	}
	return &SearchProvider{name: name}, nil
}

func (p *SearchProvider) Type() ctx.ProviderType { return ctx.ProviderSearch }
func (p *SearchProvider) Name() string           { return p.name }
func (p *SearchProvider) Description() string    { return "Search files with grep/ripgrep" }

func (p *SearchProvider) Validate(args map[string]interface{}) error {
	if _, ok := args["pattern"]; !ok {
		return fmt.Errorf("pattern is required")
	}
	return nil
}

func (p *SearchProvider) Fetch(c context.Context, args map[string]interface{}) (*ctx.ContextItem, error) {
	pattern, _ := args["pattern"].(string)
	path, _ := args["path"].(string)
	if path == "" {
		path = "."
	}

	var cmd *exec.Cmd
	if _, err := exec.LookPath("rg"); err == nil {
		cmd = exec.CommandContext(c, "rg", "-n", "--color=never", pattern, path)
	} else {
		cmd = exec.CommandContext(c, "grep", "-rn", pattern, path)
	}

	output, _ := cmd.Output()

	return &ctx.ContextItem{
		ID:         fmt.Sprintf("search:%s", pattern),
		Type:       ctx.ProviderSearch,
		Name:       fmt.Sprintf("Search: %s", pattern),
		Content:    string(output),
		TokenCount: ctx.EstimateTokens(string(output)),
		Metadata:   map[string]string{"pattern": pattern, "path": path},
	}, nil
}

type CodeProvider struct {
	name string
}

func NewCodeProvider(config ctx.ProviderConfig) (ctx.Provider, error) {
	name := config.Name
	if name == "" {
		name = "code"
	}
	return &CodeProvider{name: name}, nil
}

func (p *CodeProvider) Type() ctx.ProviderType { return ctx.ProviderCode }
func (p *CodeProvider) Name() string           { return p.name }
func (p *CodeProvider) Description() string    { return "Include code block with language" }

func (p *CodeProvider) Validate(args map[string]interface{}) error {
	if _, ok := args["content"]; !ok {
		return fmt.Errorf("content is required")
	}
	return nil
}

func (p *CodeProvider) Fetch(c context.Context, args map[string]interface{}) (*ctx.ContextItem, error) {
	content, _ := args["content"].(string)
	language, _ := args["language"].(string)
	name, _ := args["name"].(string)

	if language == "" {
		language = "text"
	}
	if name == "" {
		name = "Code Block"
	}

	formatted := fmt.Sprintf("```%s\n%s\n```", language, content)

	return &ctx.ContextItem{
		ID:         fmt.Sprintf("code:%d", time.Now().UnixNano()),
		Type:       ctx.ProviderCode,
		Name:       name,
		Content:    formatted,
		TokenCount: ctx.EstimateTokens(formatted),
		Metadata:   map[string]string{"language": language},
	}, nil
}

func RegisterBuiltinProviders(registry *ctx.Registry) {
	registry.RegisterFactory(ctx.ProviderFile, NewFileProvider)
	registry.RegisterFactory(ctx.ProviderDiff, NewDiffProvider)
	registry.RegisterFactory(ctx.ProviderTerminal, NewTerminalProvider)
	registry.RegisterFactory(ctx.ProviderHTTP, NewHTTPProvider)
	registry.RegisterFactory(ctx.ProviderFolder, NewFolderProvider)
	registry.RegisterFactory(ctx.ProviderSearch, NewSearchProvider)
	registry.RegisterFactory(ctx.ProviderCode, NewCodeProvider)
}
