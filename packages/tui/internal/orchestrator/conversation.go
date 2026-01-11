package orchestrator

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/aios/superai-cli/internal/provider"
)

type ConversationConfig struct {
	MaxMessages       int
	MaxTokens         int
	SummarizeAfter    int
	PreserveSystemMsg bool
	PreserveLastN     int
}

func DefaultConversationConfig() ConversationConfig {
	return ConversationConfig{
		MaxMessages:       100,
		MaxTokens:         100000,
		SummarizeAfter:    50,
		PreserveSystemMsg: true,
		PreserveLastN:     10,
	}
}

type Conversation struct {
	id           string
	messages     []provider.Message
	systemPrompt string
	metadata     map[string]interface{}
	config       ConversationConfig
	mu           sync.RWMutex

	totalTokens int
	createdAt   time.Time
	updatedAt   time.Time
}

func NewConversation(config ConversationConfig) *Conversation {
	return &Conversation{
		id:        generateID(),
		messages:  make([]provider.Message, 0),
		metadata:  make(map[string]interface{}),
		config:    config,
		createdAt: time.Now(),
		updatedAt: time.Now(),
	}
}

func (c *Conversation) ID() string {
	return c.id
}

func (c *Conversation) SetSystemPrompt(prompt string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.systemPrompt = prompt
	c.updatedAt = time.Now()
}

func (c *Conversation) SystemPrompt() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.systemPrompt
}

func (c *Conversation) AddMessage(msg provider.Message) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.messages = append(c.messages, msg)
	c.totalTokens += estimateTokens(msg)
	c.updatedAt = time.Now()
	c.maybeCompact()
}

func (c *Conversation) AddUserMessage(content string) {
	c.AddMessage(provider.Message{
		Role:    provider.RoleUser,
		Content: content,
	})
}

func (c *Conversation) AddAssistantMessage(content string, toolCalls []provider.ToolCall) {
	c.AddMessage(provider.Message{
		Role:      provider.RoleAssistant,
		Content:   content,
		ToolCalls: toolCalls,
	})
}

func (c *Conversation) AddToolResult(toolCallID, name string, result interface{}, isError bool) {
	var content string
	switch v := result.(type) {
	case string:
		content = v
	case error:
		content = v.Error()
	default:
		b, _ := json.Marshal(v)
		content = string(b)
	}

	c.AddMessage(provider.Message{
		Role:       provider.RoleTool,
		Content:    content,
		Name:       name,
		ToolCallID: toolCallID,
	})
}

func (c *Conversation) Messages() []provider.Message {
	c.mu.RLock()
	defer c.mu.RUnlock()

	result := make([]provider.Message, 0, len(c.messages)+1)

	if c.systemPrompt != "" {
		result = append(result, provider.Message{
			Role:    provider.RoleSystem,
			Content: c.systemPrompt,
		})
	}

	result = append(result, c.messages...)
	return result
}

func (c *Conversation) RawMessages() []provider.Message {
	c.mu.RLock()
	defer c.mu.RUnlock()
	msgs := make([]provider.Message, len(c.messages))
	copy(msgs, c.messages)
	return msgs
}

func (c *Conversation) LastMessage() *provider.Message {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if len(c.messages) == 0 {
		return nil
	}
	msg := c.messages[len(c.messages)-1]
	return &msg
}

func (c *Conversation) LastUserMessage() *provider.Message {
	c.mu.RLock()
	defer c.mu.RUnlock()
	for i := len(c.messages) - 1; i >= 0; i-- {
		if c.messages[i].Role == provider.RoleUser {
			msg := c.messages[i]
			return &msg
		}
	}
	return nil
}

func (c *Conversation) LastAssistantMessage() *provider.Message {
	c.mu.RLock()
	defer c.mu.RUnlock()
	for i := len(c.messages) - 1; i >= 0; i-- {
		if c.messages[i].Role == provider.RoleAssistant {
			msg := c.messages[i]
			return &msg
		}
	}
	return nil
}

func (c *Conversation) MessageCount() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.messages)
}

func (c *Conversation) TotalTokens() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.totalTokens
}

func (c *Conversation) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.messages = make([]provider.Message, 0)
	c.totalTokens = 0
	c.updatedAt = time.Now()
}

func (c *Conversation) ClearKeepSystem() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.messages = make([]provider.Message, 0)
	c.totalTokens = 0
	c.updatedAt = time.Now()
}

func (c *Conversation) Truncate(keepLast int) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if len(c.messages) <= keepLast {
		return
	}

	c.messages = c.messages[len(c.messages)-keepLast:]
	c.recalculateTokens()
	c.updatedAt = time.Now()
}

func (c *Conversation) TruncateToTokens(maxTokens int) {
	c.mu.Lock()
	defer c.mu.Unlock()

	for c.totalTokens > maxTokens && len(c.messages) > c.config.PreserveLastN {
		removed := c.messages[0]
		c.messages = c.messages[1:]
		c.totalTokens -= estimateTokens(removed)
	}
	c.updatedAt = time.Now()
}

func (c *Conversation) SetMetadata(key string, value interface{}) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.metadata[key] = value
}

func (c *Conversation) GetMetadata(key string) (interface{}, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	v, ok := c.metadata[key]
	return v, ok
}

func (c *Conversation) CreatedAt() time.Time {
	return c.createdAt
}

func (c *Conversation) UpdatedAt() time.Time {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.updatedAt
}

func (c *Conversation) maybeCompact() {
	if len(c.messages) > c.config.MaxMessages {
		excess := len(c.messages) - c.config.MaxMessages + c.config.PreserveLastN
		if excess > 0 && excess < len(c.messages) {
			c.messages = c.messages[excess:]
			c.recalculateTokens()
		}
	}
}

func (c *Conversation) recalculateTokens() {
	c.totalTokens = 0
	for _, msg := range c.messages {
		c.totalTokens += estimateTokens(msg)
	}
}

func estimateTokens(msg provider.Message) int {
	tokens := len(msg.Content) / 4
	for _, tc := range msg.ToolCalls {
		tokens += len(tc.Function.Name) / 4
		tokens += len(tc.Function.Arguments) / 4
	}
	tokens += 4
	return tokens
}

func generateID() string {
	return time.Now().Format("20060102150405.000000")
}

type ConversationStore struct {
	conversations map[string]*Conversation
	mu            sync.RWMutex
}

func NewConversationStore() *ConversationStore {
	return &ConversationStore{
		conversations: make(map[string]*Conversation),
	}
}

func (s *ConversationStore) Create(config ConversationConfig) *Conversation {
	conv := NewConversation(config)
	s.mu.Lock()
	s.conversations[conv.id] = conv
	s.mu.Unlock()
	return conv
}

func (s *ConversationStore) Get(id string) (*Conversation, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	c, ok := s.conversations[id]
	return c, ok
}

func (s *ConversationStore) Delete(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.conversations, id)
}

func (s *ConversationStore) List() []*Conversation {
	s.mu.RLock()
	defer s.mu.RUnlock()
	list := make([]*Conversation, 0, len(s.conversations))
	for _, c := range s.conversations {
		list = append(list, c)
	}
	return list
}

func (s *ConversationStore) Count() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.conversations)
}

type ConversationSnapshot struct {
	ID           string                 `json:"id"`
	SystemPrompt string                 `json:"system_prompt"`
	Messages     []provider.Message     `json:"messages"`
	Metadata     map[string]interface{} `json:"metadata"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
}

func (c *Conversation) Snapshot() ConversationSnapshot {
	c.mu.RLock()
	defer c.mu.RUnlock()

	msgs := make([]provider.Message, len(c.messages))
	copy(msgs, c.messages)

	meta := make(map[string]interface{})
	for k, v := range c.metadata {
		meta[k] = v
	}

	return ConversationSnapshot{
		ID:           c.id,
		SystemPrompt: c.systemPrompt,
		Messages:     msgs,
		Metadata:     meta,
		CreatedAt:    c.createdAt,
		UpdatedAt:    c.updatedAt,
	}
}

func ConversationFromSnapshot(snap ConversationSnapshot, config ConversationConfig) *Conversation {
	c := &Conversation{
		id:           snap.ID,
		systemPrompt: snap.SystemPrompt,
		messages:     snap.Messages,
		metadata:     snap.Metadata,
		config:       config,
		createdAt:    snap.CreatedAt,
		updatedAt:    snap.UpdatedAt,
	}
	c.recalculateTokens()
	return c
}

func (c *Conversation) Fork() *Conversation {
	c.mu.RLock()
	defer c.mu.RUnlock()

	msgs := make([]provider.Message, len(c.messages))
	copy(msgs, c.messages)

	meta := make(map[string]interface{})
	for k, v := range c.metadata {
		meta[k] = v
	}

	fork := &Conversation{
		id:           generateID(),
		systemPrompt: c.systemPrompt,
		messages:     msgs,
		metadata:     meta,
		config:       c.config,
		totalTokens:  c.totalTokens,
		createdAt:    time.Now(),
		updatedAt:    time.Now(),
	}

	fork.metadata["forked_from"] = c.id

	return fork
}

func (c *Conversation) Branch(fromIndex int) *Conversation {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if fromIndex < 0 || fromIndex > len(c.messages) {
		fromIndex = len(c.messages)
	}

	msgs := make([]provider.Message, fromIndex)
	copy(msgs, c.messages[:fromIndex])

	branch := &Conversation{
		id:           generateID(),
		systemPrompt: c.systemPrompt,
		messages:     msgs,
		metadata:     make(map[string]interface{}),
		config:       c.config,
		createdAt:    time.Now(),
		updatedAt:    time.Now(),
	}

	branch.recalculateTokens()
	branch.metadata["branched_from"] = c.id
	branch.metadata["branch_point"] = fromIndex

	return branch
}
