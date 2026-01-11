package rag

import (
	"bufio"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"unicode/utf8"
)

type DocumentLoader interface {
	Load(path string) ([]*Document, error)
	Supports(path string) bool
}

type ChunkConfig struct {
	ChunkSize    int
	ChunkOverlap int
	MinChunkSize int
}

func DefaultChunkConfig() *ChunkConfig {
	return &ChunkConfig{
		ChunkSize:    1000,
		ChunkOverlap: 200,
		MinChunkSize: 100,
	}
}

type SourceCodeLoader struct {
	config              *ChunkConfig
	extensionToLanguage map[string]string
	ignoreFiles         []string
}

func NewSourceCodeLoader(config *ChunkConfig) *SourceCodeLoader {
	if config == nil {
		config = DefaultChunkConfig()
	}
	return &SourceCodeLoader{
		config: config,
		extensionToLanguage: map[string]string{
			".go":    "go",
			".py":    "python",
			".js":    "javascript",
			".ts":    "typescript",
			".tsx":   "typescript",
			".jsx":   "javascript",
			".rs":    "rust",
			".c":     "c",
			".cpp":   "cpp",
			".h":     "c",
			".hpp":   "cpp",
			".java":  "java",
			".rb":    "ruby",
			".php":   "php",
			".swift": "swift",
			".kt":    "kotlin",
			".scala": "scala",
			".cs":    "csharp",
			".lua":   "lua",
			".sh":    "bash",
			".bash":  "bash",
			".zsh":   "bash",
			".sql":   "sql",
			".html":  "html",
			".css":   "css",
			".scss":  "scss",
			".yaml":  "yaml",
			".yml":   "yaml",
			".json":  "json",
			".xml":   "xml",
			".md":    "markdown",
			".txt":   "text",
		},
		ignoreFiles: []string{
			".git", "node_modules", "__pycache__", ".venv", "vendor",
			"dist", "build", ".next", ".nuxt", "target",
		},
	}
}

func (l *SourceCodeLoader) Load(path string) ([]*Document, error) {
	info, err := os.Stat(path)
	if err != nil {
		return nil, fmt.Errorf("stat %s: %w", path, err)
	}

	if info.IsDir() {
		return l.loadDirectory(path)
	}
	return l.loadFile(path)
}

func (l *SourceCodeLoader) loadDirectory(root string) ([]*Document, error) {
	var docs []*Document

	gitignore := l.loadGitignore(root)

	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}

		name := d.Name()
		for _, ignore := range l.ignoreFiles {
			if name == ignore {
				if d.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
		}

		if d.IsDir() {
			return nil
		}

		relPath, _ := filepath.Rel(root, path)
		if gitignore != nil && gitignore.Match(relPath) {
			return nil
		}

		if !l.Supports(path) {
			return nil
		}

		fileDocs, err := l.loadFile(path)
		if err != nil {
			return nil
		}

		docs = append(docs, fileDocs...)
		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("walk directory: %w", err)
	}

	return docs, nil
}

func (l *SourceCodeLoader) loadFile(path string) ([]*Document, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read file: %w", err)
	}

	if !utf8.Valid(content) {
		return nil, nil
	}

	ext := filepath.Ext(path)
	lang := l.extensionToLanguage[ext]

	chunks := l.chunkCode(string(content), lang)

	docs := make([]*Document, len(chunks))
	for i, chunk := range chunks {
		hash := sha256.Sum256([]byte(chunk))
		docs[i] = &Document{
			ID:      fmt.Sprintf("%s#%d", path, i),
			Content: chunk,
			Metadata: map[string]string{
				"path":     path,
				"language": lang,
				"chunk":    fmt.Sprintf("%d", i),
				"hash":     hex.EncodeToString(hash[:8]),
			},
		}
	}

	return docs, nil
}

func (l *SourceCodeLoader) chunkCode(content string, lang string) []string {
	lines := strings.Split(content, "\n")
	var chunks []string
	var currentChunk strings.Builder
	var currentSize int

	flushChunk := func() {
		if currentSize >= l.config.MinChunkSize {
			chunks = append(chunks, strings.TrimSpace(currentChunk.String()))
		}
		currentChunk.Reset()
		currentSize = 0
	}

	for _, line := range lines {
		lineLen := len(line) + 1

		if currentSize+lineLen > l.config.ChunkSize && currentSize > 0 {
			flushChunk()

			if l.config.ChunkOverlap > 0 {
				overlapLines := l.getOverlapLines(chunks, l.config.ChunkOverlap)
				for _, ol := range overlapLines {
					currentChunk.WriteString(ol)
					currentChunk.WriteString("\n")
					currentSize += len(ol) + 1
				}
			}
		}

		currentChunk.WriteString(line)
		currentChunk.WriteString("\n")
		currentSize += lineLen
	}

	flushChunk()

	return chunks
}

func (l *SourceCodeLoader) getOverlapLines(chunks []string, overlapSize int) []string {
	if len(chunks) == 0 {
		return nil
	}

	lastChunk := chunks[len(chunks)-1]
	lines := strings.Split(lastChunk, "\n")

	var result []string
	size := 0
	for i := len(lines) - 1; i >= 0 && size < overlapSize; i-- {
		result = append([]string{lines[i]}, result...)
		size += len(lines[i]) + 1
	}

	return result
}

func (l *SourceCodeLoader) Supports(path string) bool {
	ext := filepath.Ext(path)
	_, ok := l.extensionToLanguage[ext]
	return ok
}

type gitignorePattern struct {
	pattern  string
	negate   bool
	dirOnly  bool
	compiled *regexp.Regexp
}

type gitignoreMatcher struct {
	patterns []gitignorePattern
}

func (l *SourceCodeLoader) loadGitignore(root string) *gitignoreMatcher {
	path := filepath.Join(root, ".gitignore")
	content, err := os.ReadFile(path)
	if err != nil {
		return nil
	}

	var patterns []gitignorePattern
	scanner := bufio.NewScanner(bytes.NewReader(content))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		p := gitignorePattern{pattern: line}
		if strings.HasPrefix(line, "!") {
			p.negate = true
			p.pattern = line[1:]
		}
		if strings.HasSuffix(p.pattern, "/") {
			p.dirOnly = true
			p.pattern = strings.TrimSuffix(p.pattern, "/")
		}

		regex := gitignoreToRegex(p.pattern)
		if compiled, err := regexp.Compile(regex); err == nil {
			p.compiled = compiled
			patterns = append(patterns, p)
		}
	}

	return &gitignoreMatcher{patterns: patterns}
}

func (m *gitignoreMatcher) Match(path string) bool {
	if m == nil {
		return false
	}

	path = filepath.ToSlash(path)
	matched := false

	for _, p := range m.patterns {
		if p.compiled == nil {
			continue
		}
		if p.compiled.MatchString(path) || p.compiled.MatchString(filepath.Base(path)) {
			matched = !p.negate
		}
	}

	return matched
}

func gitignoreToRegex(pattern string) string {
	pattern = strings.ReplaceAll(pattern, ".", "\\.")
	pattern = strings.ReplaceAll(pattern, "**/", "(.*/)?")
	pattern = strings.ReplaceAll(pattern, "**", ".*")
	pattern = strings.ReplaceAll(pattern, "*", "[^/]*")
	pattern = strings.ReplaceAll(pattern, "?", "[^/]")

	if !strings.HasPrefix(pattern, "/") && !strings.HasPrefix(pattern, "(.*/)?") {
		pattern = "(.*/)?" + pattern
	}

	return "^" + pattern + "(/.*)?$"
}

type GitHistoryLoader struct {
	maxCommits int
}

func NewGitHistoryLoader(maxCommits int) *GitHistoryLoader {
	if maxCommits <= 0 {
		maxCommits = 100
	}
	return &GitHistoryLoader{maxCommits: maxCommits}
}

func (l *GitHistoryLoader) Load(repoPath string) ([]*Document, error) {
	cmd := exec.Command("git", "log",
		fmt.Sprintf("--max-count=%d", l.maxCommits),
		"--pretty=format:%H|%an|%ae|%ad|%s",
		"--date=short",
	)
	cmd.Dir = repoPath

	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("git log: %w", err)
	}

	var docs []*Document
	scanner := bufio.NewScanner(bytes.NewReader(output))
	for scanner.Scan() {
		parts := strings.SplitN(scanner.Text(), "|", 5)
		if len(parts) != 5 {
			continue
		}

		hash, author, email, date, message := parts[0], parts[1], parts[2], parts[3], parts[4]

		diffCmd := exec.Command("git", "show", "--stat", "--no-patch", hash)
		diffCmd.Dir = repoPath
		diffOutput, _ := diffCmd.Output()

		content := fmt.Sprintf("Commit: %s\nAuthor: %s <%s>\nDate: %s\n\n%s\n\n%s",
			hash[:8], author, email, date, message, string(diffOutput))

		docs = append(docs, &Document{
			ID:      fmt.Sprintf("git:%s", hash[:8]),
			Content: content,
			Metadata: map[string]string{
				"type":    "git_commit",
				"hash":    hash,
				"author":  author,
				"date":    date,
				"message": message,
			},
		})
	}

	return docs, nil
}

func (l *GitHistoryLoader) Supports(path string) bool {
	gitPath := filepath.Join(path, ".git")
	info, err := os.Stat(gitPath)
	return err == nil && info.IsDir()
}

type MarkdownLoader struct {
	config *ChunkConfig
}

func NewMarkdownLoader(config *ChunkConfig) *MarkdownLoader {
	if config == nil {
		config = DefaultChunkConfig()
	}
	return &MarkdownLoader{config: config}
}

func (l *MarkdownLoader) Load(path string) ([]*Document, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read file: %w", err)
	}

	sections := l.splitByHeaders(string(content))

	var docs []*Document
	for i, section := range sections {
		if len(strings.TrimSpace(section.content)) < l.config.MinChunkSize {
			continue
		}

		hash := sha256.Sum256([]byte(section.content))
		docs = append(docs, &Document{
			ID:      fmt.Sprintf("%s#%s", path, section.header),
			Content: section.content,
			Metadata: map[string]string{
				"path":    path,
				"type":    "markdown",
				"section": section.header,
				"index":   fmt.Sprintf("%d", i),
				"hash":    hex.EncodeToString(hash[:8]),
			},
		})
	}

	return docs, nil
}

type mdSection struct {
	header  string
	content string
}

func (l *MarkdownLoader) splitByHeaders(content string) []mdSection {
	headerRegex := regexp.MustCompile(`(?m)^(#{1,6})\s+(.+)$`)
	matches := headerRegex.FindAllStringSubmatchIndex(content, -1)

	if len(matches) == 0 {
		return []mdSection{{header: "root", content: content}}
	}

	var sections []mdSection

	if matches[0][0] > 0 {
		sections = append(sections, mdSection{
			header:  "intro",
			content: strings.TrimSpace(content[:matches[0][0]]),
		})
	}

	for i, match := range matches {
		headerStart := match[0]
		headerEnd := match[1]
		header := content[match[4]:match[5]]

		var sectionEnd int
		if i < len(matches)-1 {
			sectionEnd = matches[i+1][0]
		} else {
			sectionEnd = len(content)
		}

		sectionContent := content[headerStart:sectionEnd]

		sections = append(sections, mdSection{
			header:  header,
			content: strings.TrimSpace(sectionContent),
		})

		_ = headerEnd
	}

	return sections
}

func (l *MarkdownLoader) Supports(path string) bool {
	ext := strings.ToLower(filepath.Ext(path))
	return ext == ".md" || ext == ".markdown"
}

type CompositeLoader struct {
	loaders []DocumentLoader
}

func NewCompositeLoader(loaders ...DocumentLoader) *CompositeLoader {
	return &CompositeLoader{loaders: loaders}
}

func (c *CompositeLoader) Load(path string) ([]*Document, error) {
	for _, loader := range c.loaders {
		if loader.Supports(path) {
			return loader.Load(path)
		}
	}
	return nil, fmt.Errorf("no loader supports path: %s", path)
}

func (c *CompositeLoader) Supports(path string) bool {
	for _, loader := range c.loaders {
		if loader.Supports(path) {
			return true
		}
	}
	return false
}

func DefaultLoader() *CompositeLoader {
	return NewCompositeLoader(
		NewMarkdownLoader(nil),
		NewSourceCodeLoader(nil),
	)
}
