package collaboration

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

type MessageType string

const (
	MsgTypeTask      MessageType = "task"
	MsgTypeResult    MessageType = "result"
	MsgTypeError     MessageType = "error"
	MsgTypeStatus    MessageType = "status"
	MsgTypeBroadcast MessageType = "broadcast"
	MsgTypeHandoff   MessageType = "handoff"
)

type AgentRole string

const (
	RoleCoordinator AgentRole = "coordinator"
	RoleWorker      AgentRole = "worker"
	RoleSpecialist  AgentRole = "specialist"
	RoleReviewer    AgentRole = "reviewer"
)

type Message struct {
	ID        string          `json:"id"`
	Type      MessageType     `json:"type"`
	From      string          `json:"from"`
	To        string          `json:"to"`
	Payload   json.RawMessage `json:"payload"`
	Timestamp time.Time       `json:"timestamp"`
	ReplyTo   string          `json:"reply_to,omitempty"`
}

type TaskPayload struct {
	TaskID      string                 `json:"task_id"`
	Description string                 `json:"description"`
	Priority    int                    `json:"priority"`
	Deadline    *time.Time             `json:"deadline,omitempty"`
	Context     map[string]interface{} `json:"context,omitempty"`
	ParentTask  string                 `json:"parent_task,omitempty"`
}

type ResultPayload struct {
	TaskID  string      `json:"task_id"`
	Success bool        `json:"success"`
	Output  interface{} `json:"output"`
	Error   string      `json:"error,omitempty"`
	Metrics Metrics     `json:"metrics"`
}

type Metrics struct {
	StartTime  time.Time     `json:"start_time"`
	EndTime    time.Time     `json:"end_time"`
	Duration   time.Duration `json:"duration"`
	TokensUsed int           `json:"tokens_used,omitempty"`
	ToolCalls  int           `json:"tool_calls,omitempty"`
}

type StatusPayload struct {
	State    AgentState `json:"state"`
	Progress float64    `json:"progress"`
	Message  string     `json:"message,omitempty"`
}

type AgentState string

const (
	StateIdle      AgentState = "idle"
	StateWorking   AgentState = "working"
	StateWaiting   AgentState = "waiting"
	StateCompleted AgentState = "completed"
	StateError     AgentState = "error"
)

type CollaborationAgent struct {
	ID           string
	Name         string
	Role         AgentRole
	Capabilities []string
	State        AgentState
	inbox        chan Message
	outbox       chan Message
	mu           sync.RWMutex
}

func NewCollaborationAgent(id, name string, role AgentRole, capabilities []string) *CollaborationAgent {
	return &CollaborationAgent{
		ID:           id,
		Name:         name,
		Role:         role,
		Capabilities: capabilities,
		State:        StateIdle,
		inbox:        make(chan Message, 100),
		outbox:       make(chan Message, 100),
	}
}

func (a *CollaborationAgent) Send(msg Message) {
	msg.From = a.ID
	msg.Timestamp = time.Now()
	if msg.ID == "" {
		msg.ID = fmt.Sprintf("%s-%d", a.ID, time.Now().UnixNano())
	}
	a.outbox <- msg
}

func (a *CollaborationAgent) Receive() <-chan Message {
	return a.inbox
}

func (a *CollaborationAgent) Outbox() <-chan Message {
	return a.outbox
}

func (a *CollaborationAgent) Deliver(msg Message) {
	a.inbox <- msg
}

func (a *CollaborationAgent) SetState(state AgentState) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.State = state
}

func (a *CollaborationAgent) GetState() AgentState {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.State
}

func (a *CollaborationAgent) HasCapability(cap string) bool {
	for _, c := range a.Capabilities {
		if c == cap {
			return true
		}
	}
	return false
}

type MessageBus struct {
	agents   map[string]*CollaborationAgent
	handlers map[string]MessageHandler
	mu       sync.RWMutex
	ctx      context.Context
	cancel   context.CancelFunc
}

type MessageHandler func(msg Message)

func NewMessageBus() *MessageBus {
	ctx, cancel := context.WithCancel(context.Background())
	return &MessageBus{
		agents:   make(map[string]*CollaborationAgent),
		handlers: make(map[string]MessageHandler),
		ctx:      ctx,
		cancel:   cancel,
	}
}

func (b *MessageBus) Register(agent *CollaborationAgent) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.agents[agent.ID] = agent

	go b.routeMessages(agent)
}

func (b *MessageBus) Unregister(agentID string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	delete(b.agents, agentID)
}

func (b *MessageBus) routeMessages(agent *CollaborationAgent) {
	for {
		select {
		case <-b.ctx.Done():
			return
		case msg := <-agent.Outbox():
			b.route(msg)
		}
	}
}

func (b *MessageBus) route(msg Message) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	if msg.To == "*" {
		for _, agent := range b.agents {
			if agent.ID != msg.From {
				agent.Deliver(msg)
			}
		}
		return
	}

	if target, ok := b.agents[msg.To]; ok {
		target.Deliver(msg)
	}
}

func (b *MessageBus) Broadcast(msg Message) {
	msg.To = "*"
	msg.Type = MsgTypeBroadcast
	b.route(msg)
}

func (b *MessageBus) GetAgent(id string) *CollaborationAgent {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.agents[id]
}

func (b *MessageBus) ListAgents() []*CollaborationAgent {
	b.mu.RLock()
	defer b.mu.RUnlock()

	agents := make([]*CollaborationAgent, 0, len(b.agents))
	for _, a := range b.agents {
		agents = append(agents, a)
	}
	return agents
}

func (b *MessageBus) Stop() {
	b.cancel()
}

func NewTaskMessage(to string, task TaskPayload) (Message, error) {
	payload, err := json.Marshal(task)
	if err != nil {
		return Message{}, err
	}
	return Message{
		Type:    MsgTypeTask,
		To:      to,
		Payload: payload,
	}, nil
}

func NewResultMessage(to string, result ResultPayload) (Message, error) {
	payload, err := json.Marshal(result)
	if err != nil {
		return Message{}, err
	}
	return Message{
		Type:    MsgTypeResult,
		To:      to,
		Payload: payload,
	}, nil
}

func NewStatusMessage(to string, status StatusPayload) (Message, error) {
	payload, err := json.Marshal(status)
	if err != nil {
		return Message{}, err
	}
	return Message{
		Type:    MsgTypeStatus,
		To:      to,
		Payload: payload,
	}, nil
}

func ParseTaskPayload(msg Message) (*TaskPayload, error) {
	var task TaskPayload
	if err := json.Unmarshal(msg.Payload, &task); err != nil {
		return nil, err
	}
	return &task, nil
}

func ParseResultPayload(msg Message) (*ResultPayload, error) {
	var result ResultPayload
	if err := json.Unmarshal(msg.Payload, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func ParseStatusPayload(msg Message) (*StatusPayload, error) {
	var status StatusPayload
	if err := json.Unmarshal(msg.Payload, &status); err != nil {
		return nil, err
	}
	return &status, nil
}
