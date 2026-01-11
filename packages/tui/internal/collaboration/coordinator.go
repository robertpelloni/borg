package collaboration

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type Coordinator struct {
	pool         *AgentPool
	pendingTasks map[string]*PendingTask
	taskQueue    chan TaskPayload
	results      map[string]*ResultPayload
	mu           sync.RWMutex
	ctx          context.Context
	cancel       context.CancelFunc

	OnTaskAssigned func(taskID, agentID string)
	OnAllComplete  func(results map[string]*ResultPayload)
}

type PendingTask struct {
	Task       TaskPayload
	AssignedTo string
	Status     TaskStatus
	Retries    int
	MaxRetries int
	ResultChan chan *ResultPayload
}

type TaskStatus string

const (
	TaskPending   TaskStatus = "pending"
	TaskAssigned  TaskStatus = "assigned"
	TaskRunning   TaskStatus = "running"
	TaskCompleted TaskStatus = "completed"
	TaskFailed    TaskStatus = "failed"
)

func NewCoordinator(pool *AgentPool) *Coordinator {
	ctx, cancel := context.WithCancel(context.Background())

	c := &Coordinator{
		pool:         pool,
		pendingTasks: make(map[string]*PendingTask),
		taskQueue:    make(chan TaskPayload, 100),
		results:      make(map[string]*ResultPayload),
		ctx:          ctx,
		cancel:       cancel,
	}

	go c.dispatchLoop()

	return c
}

func (c *Coordinator) dispatchLoop() {
	for {
		select {
		case <-c.ctx.Done():
			return
		case task := <-c.taskQueue:
			c.assignTask(task)
		}
	}
}

func (c *Coordinator) assignTask(task TaskPayload) {
	c.mu.Lock()
	pending, exists := c.pendingTasks[task.TaskID]
	if !exists {
		pending = &PendingTask{
			Task:       task,
			Status:     TaskPending,
			MaxRetries: 3,
		}
		c.pendingTasks[task.TaskID] = pending
	}
	c.mu.Unlock()

	var agent *PooledAgent

	if len(task.Context) > 0 {
		if specialty, ok := task.Context["specialty"].(string); ok {
			agent = c.pool.FindAgentBySpecialty(specialty)
		}
	}

	if agent == nil {
		agent = c.pool.FindAvailableAgent()
	}

	if agent == nil {
		go func() {
			time.Sleep(100 * time.Millisecond)
			select {
			case c.taskQueue <- task:
			case <-c.ctx.Done():
			}
		}()
		return
	}

	c.mu.Lock()
	pending.AssignedTo = agent.ID
	pending.Status = TaskAssigned
	c.mu.Unlock()

	if c.OnTaskAssigned != nil {
		c.OnTaskAssigned(task.TaskID, agent.ID)
	}

	msg, err := NewTaskMessage(agent.ID, task)
	if err != nil {
		c.handleTaskError(task.TaskID, fmt.Sprintf("failed to create task message: %v", err))
		return
	}

	coordAgent := c.pool.bus.GetAgent("coordinator")
	if coordAgent == nil {
		coordAgent = NewCollaborationAgent("coordinator", "Coordinator", RoleCoordinator, nil)
		c.pool.bus.Register(coordAgent)
		go c.listenForResults(coordAgent)
	}

	msg.From = "coordinator"
	agent.Deliver(msg)

	c.mu.Lock()
	pending.Status = TaskRunning
	c.mu.Unlock()
}

func (c *Coordinator) listenForResults(coordAgent *CollaborationAgent) {
	for {
		select {
		case <-c.ctx.Done():
			return
		case msg := <-coordAgent.Receive():
			if msg.Type == MsgTypeResult {
				result, err := ParseResultPayload(msg)
				if err != nil {
					continue
				}
				c.handleResult(result)
			}
		}
	}
}

func (c *Coordinator) handleResult(result *ResultPayload) {
	c.mu.Lock()
	defer c.mu.Unlock()

	pending, exists := c.pendingTasks[result.TaskID]
	if !exists {
		return
	}

	if result.Success {
		pending.Status = TaskCompleted
		c.results[result.TaskID] = result

		if pending.ResultChan != nil {
			pending.ResultChan <- result
		}
	} else {
		pending.Retries++
		if pending.Retries < pending.MaxRetries {
			pending.Status = TaskPending
			go func() {
				select {
				case c.taskQueue <- pending.Task:
				case <-c.ctx.Done():
				}
			}()
		} else {
			pending.Status = TaskFailed
			c.results[result.TaskID] = result

			if pending.ResultChan != nil {
				pending.ResultChan <- result
			}
		}
	}
}

func (c *Coordinator) handleTaskError(taskID, errMsg string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	pending, exists := c.pendingTasks[taskID]
	if !exists {
		return
	}

	pending.Retries++
	if pending.Retries < pending.MaxRetries {
		pending.Status = TaskPending
		go func() {
			select {
			case c.taskQueue <- pending.Task:
			case <-c.ctx.Done():
			}
		}()
	} else {
		pending.Status = TaskFailed
		result := &ResultPayload{
			TaskID:  taskID,
			Success: false,
			Error:   errMsg,
		}
		c.results[taskID] = result

		if pending.ResultChan != nil {
			pending.ResultChan <- result
		}
	}
}

func (c *Coordinator) SubmitTask(task TaskPayload) error {
	if task.TaskID == "" {
		task.TaskID = fmt.Sprintf("task-%d", time.Now().UnixNano())
	}

	select {
	case c.taskQueue <- task:
		return nil
	case <-c.ctx.Done():
		return context.Canceled
	}
}

func (c *Coordinator) SubmitParallelTasks(tasks []TaskPayload) <-chan *ResultPayload {
	results := make(chan *ResultPayload, len(tasks))

	var wg sync.WaitGroup
	wg.Add(len(tasks))

	for i := range tasks {
		task := tasks[i]
		if task.TaskID == "" {
			task.TaskID = fmt.Sprintf("task-%d-%d", time.Now().UnixNano(), i)
		}

		resultChan := make(chan *ResultPayload, 1)

		c.mu.Lock()
		c.pendingTasks[task.TaskID] = &PendingTask{
			Task:       task,
			Status:     TaskPending,
			MaxRetries: 3,
			ResultChan: resultChan,
		}
		c.mu.Unlock()

		go func(t TaskPayload, rc chan *ResultPayload) {
			defer wg.Done()

			select {
			case c.taskQueue <- t:
			case <-c.ctx.Done():
				return
			}

			select {
			case result := <-rc:
				results <- result
			case <-c.ctx.Done():
				return
			}
		}(task, resultChan)
	}

	go func() {
		wg.Wait()
		close(results)
		if c.OnAllComplete != nil {
			c.mu.RLock()
			resultsCopy := make(map[string]*ResultPayload)
			for k, v := range c.results {
				resultsCopy[k] = v
			}
			c.mu.RUnlock()
			c.OnAllComplete(resultsCopy)
		}
	}()

	return results
}

func (c *Coordinator) GetTaskStatus(taskID string) (TaskStatus, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if pending, ok := c.pendingTasks[taskID]; ok {
		return pending.Status, true
	}
	return "", false
}

func (c *Coordinator) GetResult(taskID string) (*ResultPayload, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	result, ok := c.results[taskID]
	return result, ok
}

func (c *Coordinator) GetAllResults() map[string]*ResultPayload {
	c.mu.RLock()
	defer c.mu.RUnlock()

	results := make(map[string]*ResultPayload)
	for k, v := range c.results {
		results[k] = v
	}
	return results
}

func (c *Coordinator) ClearResults() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.results = make(map[string]*ResultPayload)
	for id, pending := range c.pendingTasks {
		if pending.Status == TaskCompleted || pending.Status == TaskFailed {
			delete(c.pendingTasks, id)
		}
	}
}

func (c *Coordinator) Stop() {
	c.cancel()
}
