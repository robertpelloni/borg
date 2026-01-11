package architect

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"
)

type Session struct {
	mu           sync.RWMutex
	id           string
	architect    *Architect
	conversation []ConversationTurn
	state        SessionState
	startTime    time.Time
	lastActivity time.Time
	metadata     map[string]string
}

type ConversationTurn struct {
	ID        string
	Role      string
	Content   string
	Thoughts  []Thought
	Timestamp time.Time
}

type SessionState string

const (
	StateIdle      SessionState = "idle"
	StateAnalyzing SessionState = "analyzing"
	StatePlanning  SessionState = "planning"
	StateEditing   SessionState = "editing"
	StateReviewing SessionState = "reviewing"
	StateCompleted SessionState = "completed"
)

func NewSession(id string, architect *Architect) *Session {
	now := time.Now()
	return &Session{
		id:           id,
		architect:    architect,
		conversation: make([]ConversationTurn, 0),
		state:        StateIdle,
		startTime:    now,
		lastActivity: now,
		metadata:     make(map[string]string),
	}
}

func (s *Session) ID() string {
	return s.id
}

func (s *Session) State() SessionState {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.state
}

func (s *Session) setState(state SessionState) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.state = state
	s.lastActivity = time.Now()
}

func (s *Session) AddUserMessage(content string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.conversation = append(s.conversation, ConversationTurn{
		ID:        fmt.Sprintf("turn-%d", len(s.conversation)+1),
		Role:      "user",
		Content:   content,
		Timestamp: time.Now(),
	})
	s.lastActivity = time.Now()
}

func (s *Session) AddAssistantMessage(content string, thoughts []Thought) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.conversation = append(s.conversation, ConversationTurn{
		ID:        fmt.Sprintf("turn-%d", len(s.conversation)+1),
		Role:      "assistant",
		Content:   content,
		Thoughts:  thoughts,
		Timestamp: time.Now(),
	})
	s.lastActivity = time.Now()
}

func (s *Session) Process(ctx context.Context, req *ArchitectRequest) (*ArchitectResponse, error) {
	s.AddUserMessage(req.Task)
	s.setState(StateAnalyzing)

	resp, err := s.architect.Process(ctx, req)
	if err != nil {
		s.setState(StateIdle)
		return nil, err
	}

	s.AddAssistantMessage(resp.Analysis, resp.Thoughts)
	s.setState(StateCompleted)

	return resp, nil
}

func (s *Session) GetConversation() []ConversationTurn {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]ConversationTurn, len(s.conversation))
	copy(result, s.conversation)
	return result
}

func (s *Session) GetThoughts() []Thought {
	return s.architect.GetThoughts()
}

func (s *Session) Duration() time.Duration {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return time.Since(s.startTime)
}

func (s *Session) SetMetadata(key, value string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.metadata[key] = value
}

func (s *Session) GetMetadata(key string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.metadata[key]
}

type SessionManager struct {
	mu       sync.RWMutex
	sessions map[string]*Session
	router   ModelRouter
	config   *ArchitectConfig
}

func NewSessionManager(router ModelRouter, config *ArchitectConfig) *SessionManager {
	if config == nil {
		config = DefaultArchitectConfig()
	}
	return &SessionManager{
		sessions: make(map[string]*Session),
		router:   router,
		config:   config,
	}
}

func (m *SessionManager) CreateSession(id string) *Session {
	m.mu.Lock()
	defer m.mu.Unlock()

	architect := NewArchitect(m.config, m.router)
	session := NewSession(id, architect)
	m.sessions[id] = session
	return session
}

func (m *SessionManager) GetSession(id string) (*Session, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	s, ok := m.sessions[id]
	return s, ok
}

func (m *SessionManager) DeleteSession(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.sessions, id)
}

func (m *SessionManager) ListSessions() []*Session {
	m.mu.RLock()
	defer m.mu.RUnlock()

	sessions := make([]*Session, 0, len(m.sessions))
	for _, s := range m.sessions {
		sessions = append(sessions, s)
	}
	return sessions
}

func (m *SessionManager) CleanupInactive(maxAge time.Duration) int {
	m.mu.Lock()
	defer m.mu.Unlock()

	cleaned := 0
	cutoff := time.Now().Add(-maxAge)

	for id, session := range m.sessions {
		session.mu.RLock()
		inactive := session.lastActivity.Before(cutoff)
		session.mu.RUnlock()

		if inactive {
			delete(m.sessions, id)
			cleaned++
		}
	}

	return cleaned
}

type ThinkingDisplay struct {
	thoughts chan Thought
	done     chan struct{}
}

func NewThinkingDisplay() *ThinkingDisplay {
	return &ThinkingDisplay{
		thoughts: make(chan Thought, 100),
		done:     make(chan struct{}),
	}
}

func (d *ThinkingDisplay) Stream() <-chan Thought {
	return d.thoughts
}

func (d *ThinkingDisplay) Push(t Thought) {
	select {
	case d.thoughts <- t:
	default:
	}
}

func (d *ThinkingDisplay) Close() {
	close(d.done)
	close(d.thoughts)
}

func (d *ThinkingDisplay) Format(t Thought) string {
	var sb strings.Builder

	icon := "💭"
	switch t.Type {
	case ThoughtAnalysis:
		icon = "🔍"
	case ThoughtPlanning:
		icon = "📋"
	case ThoughtReflection:
		icon = "🤔"
	case ThoughtDecision:
		icon = "✅"
	case ThoughtCorrection:
		icon = "🔧"
	}

	sb.WriteString(fmt.Sprintf("%s [%s] ", icon, t.Type))
	sb.WriteString(fmt.Sprintf("(%s)\n", t.Duration.Round(time.Millisecond)))

	lines := strings.Split(t.Content, "\n")
	for _, line := range lines {
		sb.WriteString("   ")
		sb.WriteString(line)
		sb.WriteString("\n")
	}

	return sb.String()
}
