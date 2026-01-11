package context

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"gopkg.in/yaml.v3"
)

type MemoryType string

const (
	MemoryFact     MemoryType = "fact"
	MemoryDecision MemoryType = "decision"
	MemoryPattern  MemoryType = "pattern"
	MemoryError    MemoryType = "error"
	MemoryTodo     MemoryType = "todo"
	MemoryNote     MemoryType = "note"
)

type MemoryEntry struct {
	ID        string            `yaml:"id" json:"id"`
	Type      MemoryType        `yaml:"type" json:"type"`
	Title     string            `yaml:"title" json:"title"`
	Content   string            `yaml:"content" json:"content"`
	Tags      []string          `yaml:"tags,omitempty" json:"tags,omitempty"`
	Metadata  map[string]string `yaml:"metadata,omitempty" json:"metadata,omitempty"`
	CreatedAt time.Time         `yaml:"created_at" json:"created_at"`
	UpdatedAt time.Time         `yaml:"updated_at" json:"updated_at"`
	AccessCnt int               `yaml:"access_count" json:"access_count"`
	Priority  int               `yaml:"priority" json:"priority"`
}

type MemoryIndex struct {
	Version   string    `yaml:"version"`
	UpdatedAt time.Time `yaml:"updated_at"`
	Entries   []string  `yaml:"entries"`
}

type MemoryBank struct {
	baseDir   string
	index     *MemoryIndex
	entries   map[string]*MemoryEntry
	mu        sync.RWMutex
	dirty     bool
	autoFlush bool
}

func NewMemoryBank(projectDir string) (*MemoryBank, error) {
	baseDir := filepath.Join(projectDir, ".superai", "memory")
	if err := os.MkdirAll(baseDir, 0755); err != nil {
		return nil, fmt.Errorf("creating memory directory: %w", err)
	}

	mb := &MemoryBank{
		baseDir:   baseDir,
		entries:   make(map[string]*MemoryEntry),
		autoFlush: true,
	}

	if err := mb.loadIndex(); err != nil {
		mb.index = &MemoryIndex{
			Version:   "1.0",
			UpdatedAt: time.Now(),
			Entries:   []string{},
		}
	}

	return mb, nil
}

func (mb *MemoryBank) loadIndex() error {
	indexPath := filepath.Join(mb.baseDir, "index.yaml")
	data, err := os.ReadFile(indexPath)
	if err != nil {
		return err
	}

	var index MemoryIndex
	if err := yaml.Unmarshal(data, &index); err != nil {
		return err
	}

	mb.index = &index
	return nil
}

func (mb *MemoryBank) saveIndex() error {
	mb.index.UpdatedAt = time.Now()
	data, err := yaml.Marshal(mb.index)
	if err != nil {
		return err
	}

	indexPath := filepath.Join(mb.baseDir, "index.yaml")
	return os.WriteFile(indexPath, data, 0644)
}

func (mb *MemoryBank) generateID(content string) string {
	hash := sha256.Sum256([]byte(content + time.Now().String()))
	return hex.EncodeToString(hash[:8])
}

func (mb *MemoryBank) Add(memType MemoryType, title, content string, tags []string) (*MemoryEntry, error) {
	mb.mu.Lock()
	defer mb.mu.Unlock()

	entry := &MemoryEntry{
		ID:        mb.generateID(content),
		Type:      memType,
		Title:     title,
		Content:   content,
		Tags:      tags,
		Metadata:  make(map[string]string),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		Priority:  5,
	}

	if err := mb.saveEntry(entry); err != nil {
		return nil, err
	}

	mb.entries[entry.ID] = entry
	mb.index.Entries = append(mb.index.Entries, entry.ID)
	mb.dirty = true

	if mb.autoFlush {
		mb.saveIndex()
	}

	return entry, nil
}

func (mb *MemoryBank) saveEntry(entry *MemoryEntry) error {
	filename := fmt.Sprintf("%s.md", entry.ID)
	path := filepath.Join(mb.baseDir, filename)

	var sb strings.Builder
	sb.WriteString("---\n")

	frontmatter, _ := yaml.Marshal(map[string]interface{}{
		"id":           entry.ID,
		"type":         entry.Type,
		"title":        entry.Title,
		"tags":         entry.Tags,
		"metadata":     entry.Metadata,
		"created_at":   entry.CreatedAt.Format(time.RFC3339),
		"updated_at":   entry.UpdatedAt.Format(time.RFC3339),
		"access_count": entry.AccessCnt,
		"priority":     entry.Priority,
	})
	sb.Write(frontmatter)
	sb.WriteString("---\n\n")
	sb.WriteString(entry.Content)

	return os.WriteFile(path, []byte(sb.String()), 0644)
}

func (mb *MemoryBank) loadEntry(id string) (*MemoryEntry, error) {
	filename := fmt.Sprintf("%s.md", id)
	path := filepath.Join(mb.baseDir, filename)

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	return mb.parseEntry(string(data))
}

func (mb *MemoryBank) parseEntry(data string) (*MemoryEntry, error) {
	parts := strings.SplitN(data, "---", 3)
	if len(parts) < 3 {
		return nil, fmt.Errorf("invalid memory file format")
	}

	var frontmatter map[string]interface{}
	if err := yaml.Unmarshal([]byte(parts[1]), &frontmatter); err != nil {
		return nil, err
	}

	entry := &MemoryEntry{
		Content:  strings.TrimSpace(parts[2]),
		Metadata: make(map[string]string),
	}

	if id, ok := frontmatter["id"].(string); ok {
		entry.ID = id
	}
	if t, ok := frontmatter["type"].(string); ok {
		entry.Type = MemoryType(t)
	}
	if title, ok := frontmatter["title"].(string); ok {
		entry.Title = title
	}
	if tags, ok := frontmatter["tags"].([]interface{}); ok {
		for _, t := range tags {
			if s, ok := t.(string); ok {
				entry.Tags = append(entry.Tags, s)
			}
		}
	}
	if meta, ok := frontmatter["metadata"].(map[string]interface{}); ok {
		for k, v := range meta {
			if s, ok := v.(string); ok {
				entry.Metadata[k] = s
			}
		}
	}
	if created, ok := frontmatter["created_at"].(string); ok {
		entry.CreatedAt, _ = time.Parse(time.RFC3339, created)
	}
	if updated, ok := frontmatter["updated_at"].(string); ok {
		entry.UpdatedAt, _ = time.Parse(time.RFC3339, updated)
	}
	if cnt, ok := frontmatter["access_count"].(int); ok {
		entry.AccessCnt = cnt
	}
	if pri, ok := frontmatter["priority"].(int); ok {
		entry.Priority = pri
	}

	return entry, nil
}

func (mb *MemoryBank) Get(id string) (*MemoryEntry, error) {
	mb.mu.Lock()
	defer mb.mu.Unlock()

	if entry, ok := mb.entries[id]; ok {
		entry.AccessCnt++
		return entry, nil
	}

	entry, err := mb.loadEntry(id)
	if err != nil {
		return nil, err
	}

	entry.AccessCnt++
	mb.entries[id] = entry
	return entry, nil
}

func (mb *MemoryBank) Update(id string, updates map[string]interface{}) error {
	mb.mu.Lock()
	defer mb.mu.Unlock()

	entry, ok := mb.entries[id]
	if !ok {
		var err error
		entry, err = mb.loadEntry(id)
		if err != nil {
			return err
		}
		mb.entries[id] = entry
	}

	if title, ok := updates["title"].(string); ok {
		entry.Title = title
	}
	if content, ok := updates["content"].(string); ok {
		entry.Content = content
	}
	if tags, ok := updates["tags"].([]string); ok {
		entry.Tags = tags
	}
	if priority, ok := updates["priority"].(int); ok {
		entry.Priority = priority
	}

	entry.UpdatedAt = time.Now()
	return mb.saveEntry(entry)
}

func (mb *MemoryBank) Delete(id string) error {
	mb.mu.Lock()
	defer mb.mu.Unlock()

	delete(mb.entries, id)

	for i, entryID := range mb.index.Entries {
		if entryID == id {
			mb.index.Entries = append(mb.index.Entries[:i], mb.index.Entries[i+1:]...)
			break
		}
	}

	filename := fmt.Sprintf("%s.md", id)
	path := filepath.Join(mb.baseDir, filename)
	os.Remove(path)

	mb.dirty = true
	if mb.autoFlush {
		mb.saveIndex()
	}

	return nil
}

func (mb *MemoryBank) Search(query string, filters ...func(*MemoryEntry) bool) ([]*MemoryEntry, error) {
	mb.mu.RLock()
	defer mb.mu.RUnlock()

	var results []*MemoryEntry
	query = strings.ToLower(query)

	for _, id := range mb.index.Entries {
		entry, err := mb.loadEntry(id)
		if err != nil {
			continue
		}

		if !strings.Contains(strings.ToLower(entry.Title), query) &&
			!strings.Contains(strings.ToLower(entry.Content), query) {
			continue
		}

		match := true
		for _, filter := range filters {
			if !filter(entry) {
				match = false
				break
			}
		}

		if match {
			results = append(results, entry)
		}
	}

	sort.Slice(results, func(i, j int) bool {
		if results[i].Priority != results[j].Priority {
			return results[i].Priority > results[j].Priority
		}
		return results[i].UpdatedAt.After(results[j].UpdatedAt)
	})

	return results, nil
}

func (mb *MemoryBank) ByType(memType MemoryType) ([]*MemoryEntry, error) {
	return mb.Search("", func(e *MemoryEntry) bool {
		return e.Type == memType
	})
}

func (mb *MemoryBank) ByTag(tag string) ([]*MemoryEntry, error) {
	tag = strings.ToLower(tag)
	return mb.Search("", func(e *MemoryEntry) bool {
		for _, t := range e.Tags {
			if strings.ToLower(t) == tag {
				return true
			}
		}
		return false
	})
}

func (mb *MemoryBank) Recent(limit int) ([]*MemoryEntry, error) {
	mb.mu.RLock()
	defer mb.mu.RUnlock()

	var entries []*MemoryEntry
	for _, id := range mb.index.Entries {
		entry, err := mb.loadEntry(id)
		if err != nil {
			continue
		}
		entries = append(entries, entry)
	}

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].UpdatedAt.After(entries[j].UpdatedAt)
	})

	if limit > 0 && len(entries) > limit {
		entries = entries[:limit]
	}

	return entries, nil
}

func (mb *MemoryBank) MostAccessed(limit int) ([]*MemoryEntry, error) {
	mb.mu.RLock()
	defer mb.mu.RUnlock()

	var entries []*MemoryEntry
	for _, id := range mb.index.Entries {
		entry, err := mb.loadEntry(id)
		if err != nil {
			continue
		}
		entries = append(entries, entry)
	}

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].AccessCnt > entries[j].AccessCnt
	})

	if limit > 0 && len(entries) > limit {
		entries = entries[:limit]
	}

	return entries, nil
}

func (mb *MemoryBank) ToContextItem(entry *MemoryEntry) *ContextItem {
	return &ContextItem{
		ID:          fmt.Sprintf("memory:%s", entry.ID),
		Type:        ProviderCustom,
		Name:        entry.Title,
		Description: fmt.Sprintf("[%s] %s", entry.Type, strings.Join(entry.Tags, ", ")),
		Content:     entry.Content,
		TokenCount:  EstimateTokens(entry.Content),
		Priority:    entry.Priority,
		Metadata: map[string]string{
			"memory_id":   entry.ID,
			"memory_type": string(entry.Type),
		},
	}
}

func (mb *MemoryBank) BuildContext(query string, tokenBudget int) ([]*ContextItem, error) {
	entries, err := mb.Search(query)
	if err != nil {
		return nil, err
	}

	var items []*ContextItem
	totalTokens := 0

	for _, entry := range entries {
		item := mb.ToContextItem(entry)
		if tokenBudget > 0 && totalTokens+item.TokenCount > tokenBudget {
			break
		}
		items = append(items, item)
		totalTokens += item.TokenCount
	}

	return items, nil
}

func (mb *MemoryBank) Export() ([]byte, error) {
	mb.mu.RLock()
	defer mb.mu.RUnlock()

	var entries []*MemoryEntry
	for _, id := range mb.index.Entries {
		entry, err := mb.loadEntry(id)
		if err != nil {
			continue
		}
		entries = append(entries, entry)
	}

	return json.MarshalIndent(entries, "", "  ")
}

func (mb *MemoryBank) Import(data []byte, merge bool) error {
	var entries []*MemoryEntry
	if err := json.Unmarshal(data, &entries); err != nil {
		return err
	}

	mb.mu.Lock()
	defer mb.mu.Unlock()

	if !merge {
		for _, id := range mb.index.Entries {
			filename := fmt.Sprintf("%s.md", id)
			os.Remove(filepath.Join(mb.baseDir, filename))
		}
		mb.index.Entries = []string{}
		mb.entries = make(map[string]*MemoryEntry)
	}

	for _, entry := range entries {
		if merge {
			entry.ID = mb.generateID(entry.Content)
		}
		if err := mb.saveEntry(entry); err != nil {
			continue
		}
		mb.entries[entry.ID] = entry
		mb.index.Entries = append(mb.index.Entries, entry.ID)
	}

	return mb.saveIndex()
}

func (mb *MemoryBank) Stats() map[string]interface{} {
	mb.mu.RLock()
	defer mb.mu.RUnlock()

	typeCounts := make(map[MemoryType]int)
	totalAccess := 0

	for _, id := range mb.index.Entries {
		entry, err := mb.loadEntry(id)
		if err != nil {
			continue
		}
		typeCounts[entry.Type]++
		totalAccess += entry.AccessCnt
	}

	return map[string]interface{}{
		"total_entries":  len(mb.index.Entries),
		"type_counts":    typeCounts,
		"total_accesses": totalAccess,
		"base_dir":       mb.baseDir,
		"index_updated":  mb.index.UpdatedAt,
	}
}

func (mb *MemoryBank) Flush() error {
	mb.mu.Lock()
	defer mb.mu.Unlock()

	if !mb.dirty {
		return nil
	}

	for _, entry := range mb.entries {
		mb.saveEntry(entry)
	}

	mb.dirty = false
	return mb.saveIndex()
}

func (mb *MemoryBank) Close() error {
	return mb.Flush()
}

func FilterByType(memType MemoryType) func(*MemoryEntry) bool {
	return func(e *MemoryEntry) bool {
		return e.Type == memType
	}
}

func FilterByPriority(minPriority int) func(*MemoryEntry) bool {
	return func(e *MemoryEntry) bool {
		return e.Priority >= minPriority
	}
}

func FilterByAge(maxAge time.Duration) func(*MemoryEntry) bool {
	return func(e *MemoryEntry) bool {
		return time.Since(e.UpdatedAt) <= maxAge
	}
}
