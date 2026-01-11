package collaboration

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/aios/superai-cli/internal/llm"
)

type AgentPool struct {
	agents      map[string]*PooledAgent
	bus         *MessageBus
	coordinator *Coordinator
	mu          sync.RWMutex
	ctx         context.Context
	cancel      context.CancelFunc

	OnAgentStateChange func(agentID string, state AgentState)
	OnTaskComplete     func(taskID string, result *ResultPayload)
	OnProgress         func(agentID string, progress float64, message string)
}

type PooledAgent struct {
	*CollaborationAgent
	Engine      *llm.ReActEngine
	Provider    llm.Provider
	Specialties []string
	MaxTasks    int
	ActiveTasks int
}

type PoolConfig struct {
	MaxAgents       int
	DefaultProvider llm.Provider
}

func NewAgentPool(cfg PoolConfig) *AgentPool {
	ctx, cancel := context.WithCancel(context.Background())
	bus := NewMessageBus()

	pool := &AgentPool{
		agents: make(map[string]*PooledAgent),
		bus:    bus,
		ctx:    ctx,
		cancel: cancel,
	}

	pool.coordinator = NewCoordinator(pool)

	return pool
}

func (p *AgentPool) AddAgent(id, name string, role AgentRole, provider llm.Provider, specialties []string) *PooledAgent {
	p.mu.Lock()
	defer p.mu.Unlock()

	collabAgent := NewCollaborationAgent(id, name, role, specialties)

	engine := llm.NewReActEngine(llm.ReActConfig{
		Provider:      provider,
		MaxIterations: 10,
	})

	pooled := &PooledAgent{
		CollaborationAgent: collabAgent,
		Engine:             engine,
		Provider:           provider,
		Specialties:        specialties,
		MaxTasks:           3,
		ActiveTasks:        0,
	}

	p.agents[id] = pooled
	p.bus.Register(collabAgent)

	go p.runAgentLoop(pooled)

	return pooled
}

func (p *AgentPool) RemoveAgent(id string) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if agent, ok := p.agents[id]; ok {
		p.bus.Unregister(id)
		close(agent.inbox)
		delete(p.agents, id)
	}
}

func (p *AgentPool) GetAgent(id string) *PooledAgent {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.agents[id]
}

func (p *AgentPool) ListAgents() []*PooledAgent {
	p.mu.RLock()
	defer p.mu.RUnlock()

	agents := make([]*PooledAgent, 0, len(p.agents))
	for _, a := range p.agents {
		agents = append(agents, a)
	}
	return agents
}

func (p *AgentPool) FindAgentBySpecialty(specialty string) *PooledAgent {
	p.mu.RLock()
	defer p.mu.RUnlock()

	var best *PooledAgent
	for _, agent := range p.agents {
		if agent.GetState() == StateIdle || agent.ActiveTasks < agent.MaxTasks {
			for _, s := range agent.Specialties {
				if s == specialty {
					if best == nil || agent.ActiveTasks < best.ActiveTasks {
						best = agent
					}
				}
			}
		}
	}
	return best
}

func (p *AgentPool) FindAvailableAgent() *PooledAgent {
	p.mu.RLock()
	defer p.mu.RUnlock()

	for _, agent := range p.agents {
		if agent.GetState() == StateIdle || agent.ActiveTasks < agent.MaxTasks {
			return agent
		}
	}
	return nil
}

func (p *AgentPool) runAgentLoop(agent *PooledAgent) {
	for {
		select {
		case <-p.ctx.Done():
			return
		case msg, ok := <-agent.Receive():
			if !ok {
				return
			}
			p.handleAgentMessage(agent, msg)
		}
	}
}

func (p *AgentPool) handleAgentMessage(agent *PooledAgent, msg Message) {
	switch msg.Type {
	case MsgTypeTask:
		task, err := ParseTaskPayload(msg)
		if err != nil {
			p.sendError(agent, msg.From, fmt.Sprintf("invalid task payload: %v", err))
			return
		}
		go p.executeTask(agent, msg.From, task)

	case MsgTypeStatus:
		status, _ := ParseStatusPayload(msg)
		if p.OnProgress != nil && status != nil {
			p.OnProgress(agent.ID, status.Progress, status.Message)
		}
	}
}

func (p *AgentPool) executeTask(agent *PooledAgent, replyTo string, task *TaskPayload) {
	agent.mu.Lock()
	agent.ActiveTasks++
	agent.State = StateWorking
	agent.mu.Unlock()

	if p.OnAgentStateChange != nil {
		p.OnAgentStateChange(agent.ID, StateWorking)
	}

	startTime := time.Now()

	response, err := agent.Engine.Run(p.ctx, task.Description)

	endTime := time.Now()
	duration := endTime.Sub(startTime)

	agent.mu.Lock()
	agent.ActiveTasks--
	if agent.ActiveTasks == 0 {
		agent.State = StateIdle
	}
	agent.mu.Unlock()

	result := ResultPayload{
		TaskID:  task.TaskID,
		Success: err == nil,
		Output:  response,
		Metrics: Metrics{
			StartTime: startTime,
			EndTime:   endTime,
			Duration:  duration,
		},
	}

	if err != nil {
		result.Error = err.Error()
		agent.SetState(StateError)
	}

	resultMsg, _ := NewResultMessage(replyTo, result)
	agent.Send(resultMsg)

	if p.OnAgentStateChange != nil {
		p.OnAgentStateChange(agent.ID, agent.GetState())
	}

	if p.OnTaskComplete != nil {
		p.OnTaskComplete(task.TaskID, &result)
	}
}

func (p *AgentPool) sendError(agent *PooledAgent, to, errMsg string) {
	result := ResultPayload{
		Success: false,
		Error:   errMsg,
	}
	msg, _ := NewResultMessage(to, result)
	agent.Send(msg)
}

func (p *AgentPool) SubmitTask(task TaskPayload) error {
	return p.coordinator.SubmitTask(task)
}

func (p *AgentPool) SubmitParallelTasks(tasks []TaskPayload) <-chan *ResultPayload {
	return p.coordinator.SubmitParallelTasks(tasks)
}

func (p *AgentPool) GetCoordinator() *Coordinator {
	return p.coordinator
}

func (p *AgentPool) Stop() {
	p.cancel()
	p.bus.Stop()
}

func (p *AgentPool) Stats() PoolStats {
	p.mu.RLock()
	defer p.mu.RUnlock()

	stats := PoolStats{
		TotalAgents: len(p.agents),
	}

	for _, agent := range p.agents {
		switch agent.GetState() {
		case StateIdle:
			stats.IdleAgents++
		case StateWorking:
			stats.WorkingAgents++
		case StateError:
			stats.ErrorAgents++
		}
		stats.TotalActiveTasks += agent.ActiveTasks
	}

	return stats
}

type PoolStats struct {
	TotalAgents      int
	IdleAgents       int
	WorkingAgents    int
	ErrorAgents      int
	TotalActiveTasks int
}
