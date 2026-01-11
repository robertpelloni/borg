package session

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/aios/superai-cli/internal/llm"
)

// SessionState represents the persistence state of a session
type SessionState string

const (
	StateActive    SessionState = "active"
	StatePaused    SessionState = "paused"
	StateCompleted SessionState = "completed"
	StateArchived  SessionState = "archived"
)

// Message represents a chat message in session history
type Message struct {
	ID        string                 `json:"id"`
	Role      string                 `json:"role"` // "user", "assistant", "system", "tool"
	Content   string                 `json:"content"`
	Timestamp time.Time              `json:"timestamp"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
	ToolCalls []ToolCallRecord       `json:"tool_calls,omitempty"`
}

// ToolCallRecord captures a tool invocation in history
type ToolCallRecord struct {
	ID        string                 `json:"id"`
	Name      string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments"`
	Result    string                 `json:"result,omitempty"`
	Error     string                 `json:"error,omitempty"`
	Duration  time.Duration          `json:"duration"`
	Timestamp time.Time              `json:"timestamp"`
}

// UsageStats tracks token and cost usage
type UsageStats struct {
	TotalPromptTokens     int     `json:"total_prompt_tokens"`
	TotalCompletionTokens int     `json:"total_completion_tokens"`
	TotalTokens           int     `json:"total_tokens"`
	EstimatedCost         float64 `json:"estimated_cost"`
	RequestCount          int     `json:"request_count"`
}

// AgentExecution records an external agent run
type AgentExecution struct {
	AgentName string        `json:"agent_name"`
	Command   string        `json:"command"`
	Args      []string      `json:"args,omitempty"`
	StartTime time.Time     `json:"start_time"`
	EndTime   time.Time     `json:"end_time,omitempty"`
	ExitCode  int           `json:"exit_code,omitempty"`
	Output    string        `json:"output,omitempty"`
	Duration  time.Duration `json:"duration,omitempty"`
}

// SessionMetadata contains session information
type SessionMetadata struct {
	ID          string       `json:"id"`
	Name        string       `json:"name"`
	Description string       `json:"description,omitempty"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
	State       SessionState `json:"state"`
	Tags        []string     `json:"tags,omitempty"`
	WorkingDir  string       `json:"working_dir,omitempty"`
	Version     string       `json:"version"` // SuperAI CLI version
}

// Session represents a complete orchestration session
type Session struct {
	Metadata    SessionMetadata  `json:"metadata"`
	Messages    []Message        `json:"messages"`
	Usage       UsageStats       `json:"usage"`
	Agents      []AgentExecution `json:"agents,omitempty"`
	LLMConfig   LLMSnapshot      `json:"llm_config,omitempty"`
	ToolsUsed   []string         `json:"tools_used,omitempty"`
	Checkpoints []Checkpoint     `json:"checkpoints,omitempty"`
}

// LLMSnapshot captures LLM configuration at session time
type LLMSnapshot struct {
	Provider    string  `json:"provider"`
	Model       string  `json:"model"`
	Temperature float64 `json:"temperature,omitempty"`
	MaxTokens   int     `json:"max_tokens,omitempty"`
}

// Checkpoint represents a saveable point in session
type Checkpoint struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	MessageIndex int       `json:"message_index"` // Index in Messages slice
	Timestamp    time.Time `json:"timestamp"`
	Notes        string    `json:"notes,omitempty"`
}

// SessionSummary is a lightweight view for listing sessions
type SessionSummary struct {
	ID           string       `json:"id"`
	Name         string       `json:"name"`
	State        SessionState `json:"state"`
	CreatedAt    time.Time    `json:"created_at"`
	UpdatedAt    time.Time    `json:"updated_at"`
	MessageCount int          `json:"message_count"`
	TotalTokens  int          `json:"total_tokens"`
}

// NewSession creates a new session with generated ID
func NewSession(name string) *Session {
	id := generateID()
	now := time.Now()

	return &Session{
		Metadata: SessionMetadata{
			ID:        id,
			Name:      name,
			CreatedAt: now,
			UpdatedAt: now,
			State:     StateActive,
			Version:   "0.6.0",
		},
		Messages:    []Message{},
		Usage:       UsageStats{},
		Agents:      []AgentExecution{},
		ToolsUsed:   []string{},
		Checkpoints: []Checkpoint{},
	}
}

// AddMessage appends a message to the session
func (s *Session) AddMessage(role, content string, metadata map[string]interface{}) {
	msg := Message{
		ID:        generateID(),
		Role:      role,
		Content:   content,
		Timestamp: time.Now(),
		Metadata:  metadata,
	}
	s.Messages = append(s.Messages, msg)
	s.Metadata.UpdatedAt = time.Now()
}

// AddToolCall records a tool execution
func (s *Session) AddToolCall(msgIdx int, tc ToolCallRecord) {
	if msgIdx >= 0 && msgIdx < len(s.Messages) {
		s.Messages[msgIdx].ToolCalls = append(s.Messages[msgIdx].ToolCalls, tc)
		// Track unique tools used
		for _, t := range s.ToolsUsed {
			if t == tc.Name {
				return
			}
		}
		s.ToolsUsed = append(s.ToolsUsed, tc.Name)
	}
}

// AddAgentExecution records an agent run
func (s *Session) AddAgentExecution(exec AgentExecution) {
	s.Agents = append(s.Agents, exec)
	s.Metadata.UpdatedAt = time.Now()
}

// UpdateUsage adds token usage to totals
func (s *Session) UpdateUsage(usage llm.Usage) {
	s.Usage.TotalPromptTokens += usage.PromptTokens
	s.Usage.TotalCompletionTokens += usage.CompletionTokens
	s.Usage.TotalTokens += usage.TotalTokens
	s.Usage.RequestCount++
	s.Metadata.UpdatedAt = time.Now()
}

// CreateCheckpoint saves current position as a checkpoint
func (s *Session) CreateCheckpoint(name, notes string) *Checkpoint {
	cp := Checkpoint{
		ID:           generateID(),
		Name:         name,
		MessageIndex: len(s.Messages),
		Timestamp:    time.Now(),
		Notes:        notes,
	}
	s.Checkpoints = append(s.Checkpoints, cp)
	return &cp
}

// ReplayTo returns messages up to a checkpoint
func (s *Session) ReplayTo(checkpointID string) []Message {
	for _, cp := range s.Checkpoints {
		if cp.ID == checkpointID {
			if cp.MessageIndex <= len(s.Messages) {
				return s.Messages[:cp.MessageIndex]
			}
		}
	}
	return nil
}

// ToSummary creates a lightweight summary
func (s *Session) ToSummary() SessionSummary {
	return SessionSummary{
		ID:           s.Metadata.ID,
		Name:         s.Metadata.Name,
		State:        s.Metadata.State,
		CreatedAt:    s.Metadata.CreatedAt,
		UpdatedAt:    s.Metadata.UpdatedAt,
		MessageCount: len(s.Messages),
		TotalTokens:  s.Usage.TotalTokens,
	}
}

// Manager handles session persistence operations
type Manager struct {
	sessionsDir string
	mu          sync.RWMutex
	cache       map[string]*Session
}

// NewManager creates a session manager
func NewManager() (*Manager, error) {
	dir, err := sessionsDir()
	if err != nil {
		return nil, fmt.Errorf("get sessions dir: %w", err)
	}

	// Ensure directory exists
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("create sessions dir: %w", err)
	}

	return &Manager{
		sessionsDir: dir,
		cache:       make(map[string]*Session),
	}, nil
}

// Save persists a session to disk
func (m *Manager) Save(s *Session) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	s.Metadata.UpdatedAt = time.Now()
	m.cache[s.Metadata.ID] = s

	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal session: %w", err)
	}

	path := m.sessionPath(s.Metadata.ID)
	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("write session file: %w", err)
	}

	return nil
}

// Load retrieves a session by ID
func (m *Manager) Load(id string) (*Session, error) {
	m.mu.RLock()
	if s, ok := m.cache[id]; ok {
		m.mu.RUnlock()
		return s, nil
	}
	m.mu.RUnlock()

	m.mu.Lock()
	defer m.mu.Unlock()

	path := m.sessionPath(id)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("session not found: %s", id)
		}
		return nil, fmt.Errorf("read session file: %w", err)
	}

	var s Session
	if err := json.Unmarshal(data, &s); err != nil {
		return nil, fmt.Errorf("unmarshal session: %w", err)
	}

	m.cache[id] = &s
	return &s, nil
}

// List returns summaries of all sessions
func (m *Manager) List() ([]SessionSummary, error) {
	entries, err := os.ReadDir(m.sessionsDir)
	if err != nil {
		return nil, fmt.Errorf("read sessions dir: %w", err)
	}

	var summaries []SessionSummary
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}

		id := strings.TrimSuffix(entry.Name(), ".json")
		s, err := m.Load(id)
		if err != nil {
			continue // Skip invalid sessions
		}
		summaries = append(summaries, s.ToSummary())
	}

	// Sort by updated time (most recent first)
	sort.Slice(summaries, func(i, j int) bool {
		return summaries[i].UpdatedAt.After(summaries[j].UpdatedAt)
	})

	return summaries, nil
}

// Delete removes a session
func (m *Manager) Delete(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.cache, id)

	path := m.sessionPath(id)
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("remove session file: %w", err)
	}

	return nil
}

// Export serializes a session for sharing
func (m *Manager) Export(id string) ([]byte, error) {
	s, err := m.Load(id)
	if err != nil {
		return nil, err
	}

	return json.MarshalIndent(s, "", "  ")
}

// Import loads a session from exported data
func (m *Manager) Import(data []byte) (*Session, error) {
	var s Session
	if err := json.Unmarshal(data, &s); err != nil {
		return nil, fmt.Errorf("unmarshal session: %w", err)
	}

	// Generate new ID to avoid conflicts
	oldID := s.Metadata.ID
	s.Metadata.ID = generateID()
	s.Metadata.Name = s.Metadata.Name + " (imported)"
	s.Metadata.UpdatedAt = time.Now()

	// Remove from old cache if present
	m.mu.Lock()
	delete(m.cache, oldID)
	m.mu.Unlock()

	// Save with new ID
	if err := m.Save(&s); err != nil {
		return nil, fmt.Errorf("save imported session: %w", err)
	}

	return &s, nil
}

// Archive marks a session as archived
func (m *Manager) Archive(id string) error {
	s, err := m.Load(id)
	if err != nil {
		return err
	}

	s.Metadata.State = StateArchived
	return m.Save(s)
}

// Search finds sessions by name or tag
func (m *Manager) Search(query string) ([]SessionSummary, error) {
	all, err := m.List()
	if err != nil {
		return nil, err
	}

	query = strings.ToLower(query)
	var matches []SessionSummary

	for _, sum := range all {
		if strings.Contains(strings.ToLower(sum.Name), query) {
			matches = append(matches, sum)
			continue
		}

		// Also search in tags (need to load full session)
		s, err := m.Load(sum.ID)
		if err != nil {
			continue
		}
		for _, tag := range s.Metadata.Tags {
			if strings.Contains(strings.ToLower(tag), query) {
				matches = append(matches, sum)
				break
			}
		}
	}

	return matches, nil
}

// GetRecent returns the N most recently updated sessions
func (m *Manager) GetRecent(n int) ([]SessionSummary, error) {
	all, err := m.List()
	if err != nil {
		return nil, err
	}

	if n > len(all) {
		n = len(all)
	}
	return all[:n], nil
}

// sessionPath returns the file path for a session
func (m *Manager) sessionPath(id string) string {
	return filepath.Join(m.sessionsDir, id+".json")
}

// sessionsDir returns the sessions directory path
func sessionsDir() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(homeDir, ".superai", "sessions"), nil
}

// generateID creates a random session ID
func generateID() string {
	bytes := make([]byte, 8)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// ConvertLLMMessages converts llm.Message slice to session Messages
func ConvertLLMMessages(msgs []llm.Message) []Message {
	result := make([]Message, 0, len(msgs))
	for _, m := range msgs {
		msg := Message{
			ID:        generateID(),
			Role:      string(m.Role),
			Content:   m.Content,
			Timestamp: time.Now(),
		}

		// Convert tool calls if present
		if len(m.ToolCalls) > 0 {
			for _, tc := range m.ToolCalls {
				args := make(map[string]interface{})
				json.Unmarshal([]byte(tc.Function.Arguments), &args)
				msg.ToolCalls = append(msg.ToolCalls, ToolCallRecord{
					ID:        tc.ID,
					Name:      tc.Function.Name,
					Arguments: args,
					Timestamp: time.Now(),
				})
			}
		}

		result = append(result, msg)
	}
	return result
}

// ToLLMMessages converts session Messages back to llm.Message slice
func ToLLMMessages(msgs []Message) []llm.Message {
	result := make([]llm.Message, 0, len(msgs))
	for _, m := range msgs {
		msg := llm.Message{
			Role:    llm.Role(m.Role),
			Content: m.Content,
		}

		// Convert tool calls if present
		if len(m.ToolCalls) > 0 {
			for _, tc := range m.ToolCalls {
				args, _ := json.Marshal(tc.Arguments)
				msg.ToolCalls = append(msg.ToolCalls, llm.ToolCall{
					ID: tc.ID,
					Function: llm.FunctionCall{
						Name:      tc.Name,
						Arguments: string(args),
					},
				})
			}
		}

		// Handle tool results
		if m.Role == "tool" && len(m.ToolCalls) > 0 {
			tc := m.ToolCalls[0]
			msg.ToolCallID = tc.ID
			msg.Name = tc.Name
			msg.Content = tc.Result
		}

		result = append(result, msg)
	}
	return result
}
