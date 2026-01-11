package plugin

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type EventType string

const (
	EventPluginRegistered   EventType = "plugin.registered"
	EventPluginUnregistered EventType = "plugin.unregistered"
	EventPluginInitialized  EventType = "plugin.initialized"
	EventPluginStarted      EventType = "plugin.started"
	EventPluginStopped      EventType = "plugin.stopped"
	EventPluginError        EventType = "plugin.error"
	EventPluginHealthChange EventType = "plugin.health_change"
	EventPluginReloaded     EventType = "plugin.reloaded"
	EventPluginConfigChange EventType = "plugin.config_change"
	EventToolRegistered     EventType = "tool.registered"
	EventToolUnregistered   EventType = "tool.unregistered"
	EventToolExecuted       EventType = "tool.executed"
	EventToolError          EventType = "tool.error"
	EventAgentStarted       EventType = "agent.started"
	EventAgentStopped       EventType = "agent.stopped"
	EventAgentMessage       EventType = "agent.message"
	EventSystemStartup      EventType = "system.startup"
	EventSystemShutdown     EventType = "system.shutdown"
	EventSystemError        EventType = "system.error"
)

type EventPriority int

const (
	PriorityLow EventPriority = iota
	PriorityNormal
	PriorityHigh
	PriorityCritical
)

type Event struct {
	ID        string
	Type      EventType
	Source    string
	Target    string
	Priority  EventPriority
	Timestamp time.Time
	Data      map[string]any
	Error     error
	Metadata  map[string]string
}

func NewEvent(eventType EventType, source string) *Event {
	return &Event{
		ID:        generateEventID(),
		Type:      eventType,
		Source:    source,
		Priority:  PriorityNormal,
		Timestamp: time.Now(),
		Data:      make(map[string]any),
		Metadata:  make(map[string]string),
	}
}

func (e *Event) WithTarget(target string) *Event {
	e.Target = target
	return e
}

func (e *Event) WithPriority(priority EventPriority) *Event {
	e.Priority = priority
	return e
}

func (e *Event) WithData(key string, value any) *Event {
	e.Data[key] = value
	return e
}

func (e *Event) WithError(err error) *Event {
	e.Error = err
	return e
}

func (e *Event) WithMetadata(key, value string) *Event {
	e.Metadata[key] = value
	return e
}

type EventHandler func(ctx context.Context, event *Event) error

type EventFilter func(event *Event) bool

type Subscription struct {
	ID        string
	EventType EventType
	Handler   EventHandler
	Filter    EventFilter
	Priority  EventPriority
	Once      bool
	Active    bool
}

type EventBus struct {
	mu            sync.RWMutex
	subscriptions map[EventType][]*Subscription
	allHandlers   []*Subscription
	eventCh       chan *Event
	stopCh        chan struct{}
	running       bool
	bufferSize    int
	errorHandler  func(error)
	metrics       *EventMetrics
}

type EventMetrics struct {
	mu             sync.RWMutex
	TotalEvents    int64
	EventsByType   map[EventType]int64
	ErrorCount     int64
	DroppedCount   int64
	AvgProcessTime time.Duration
	LastEventTime  time.Time
}

type EventBusConfig struct {
	BufferSize   int
	Workers      int
	ErrorHandler func(error)
}

func DefaultEventBusConfig() EventBusConfig {
	return EventBusConfig{
		BufferSize:   1000,
		Workers:      4,
		ErrorHandler: nil,
	}
}

func NewEventBus(config EventBusConfig) *EventBus {
	return &EventBus{
		subscriptions: make(map[EventType][]*Subscription),
		allHandlers:   make([]*Subscription, 0),
		eventCh:       make(chan *Event, config.BufferSize),
		stopCh:        make(chan struct{}),
		bufferSize:    config.BufferSize,
		errorHandler:  config.ErrorHandler,
		metrics: &EventMetrics{
			EventsByType: make(map[EventType]int64),
		},
	}
}

func (b *EventBus) Start(ctx context.Context, workers int) {
	b.mu.Lock()
	if b.running {
		b.mu.Unlock()
		return
	}
	b.running = true
	b.stopCh = make(chan struct{})
	b.mu.Unlock()

	for i := 0; i < workers; i++ {
		go b.worker(ctx, i)
	}
}

func (b *EventBus) Stop() {
	b.mu.Lock()
	if !b.running {
		b.mu.Unlock()
		return
	}
	b.running = false
	close(b.stopCh)
	b.mu.Unlock()
}

func (b *EventBus) worker(ctx context.Context, _ int) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-b.stopCh:
			return
		case event := <-b.eventCh:
			b.processEvent(ctx, event)
		}
	}
}

func (b *EventBus) processEvent(ctx context.Context, event *Event) {
	start := time.Now()

	b.mu.RLock()
	handlers := make([]*Subscription, 0)
	if subs, ok := b.subscriptions[event.Type]; ok {
		for _, sub := range subs {
			if sub.Active && (sub.Filter == nil || sub.Filter(event)) {
				handlers = append(handlers, sub)
			}
		}
	}
	for _, sub := range b.allHandlers {
		if sub.Active && (sub.Filter == nil || sub.Filter(event)) {
			handlers = append(handlers, sub)
		}
	}
	b.mu.RUnlock()

	sortByPriority(handlers)

	var toRemove []string
	for _, sub := range handlers {
		if err := sub.Handler(ctx, event); err != nil {
			b.handleError(err)
		}
		if sub.Once {
			toRemove = append(toRemove, sub.ID)
		}
	}

	if len(toRemove) > 0 {
		b.mu.Lock()
		for _, id := range toRemove {
			b.removeSubscription(id)
		}
		b.mu.Unlock()
	}

	b.updateMetrics(event, time.Since(start))
}

func (b *EventBus) handleError(err error) {
	b.metrics.mu.Lock()
	b.metrics.ErrorCount++
	b.metrics.mu.Unlock()
	if b.errorHandler != nil {
		b.errorHandler(err)
	}
}

func (b *EventBus) updateMetrics(event *Event, duration time.Duration) {
	b.metrics.mu.Lock()
	defer b.metrics.mu.Unlock()
	b.metrics.TotalEvents++
	b.metrics.EventsByType[event.Type]++
	b.metrics.LastEventTime = time.Now()
	n := b.metrics.TotalEvents
	b.metrics.AvgProcessTime = time.Duration((int64(b.metrics.AvgProcessTime)*(n-1) + int64(duration)) / n)
}

func (b *EventBus) Subscribe(eventType EventType, handler EventHandler) string {
	sub := &Subscription{
		ID:        generateSubscriptionID(),
		EventType: eventType,
		Handler:   handler,
		Priority:  PriorityNormal,
		Active:    true,
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	b.subscriptions[eventType] = append(b.subscriptions[eventType], sub)
	return sub.ID
}

func (b *EventBus) SubscribeWithFilter(eventType EventType, handler EventHandler, filter EventFilter) string {
	sub := &Subscription{
		ID:        generateSubscriptionID(),
		EventType: eventType,
		Handler:   handler,
		Filter:    filter,
		Priority:  PriorityNormal,
		Active:    true,
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	b.subscriptions[eventType] = append(b.subscriptions[eventType], sub)
	return sub.ID
}

func (b *EventBus) SubscribeOnce(eventType EventType, handler EventHandler) string {
	sub := &Subscription{
		ID:        generateSubscriptionID(),
		EventType: eventType,
		Handler:   handler,
		Priority:  PriorityNormal,
		Once:      true,
		Active:    true,
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	b.subscriptions[eventType] = append(b.subscriptions[eventType], sub)
	return sub.ID
}

func (b *EventBus) SubscribeAll(handler EventHandler) string {
	sub := &Subscription{
		ID:       generateSubscriptionID(),
		Handler:  handler,
		Priority: PriorityNormal,
		Active:   true,
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	b.allHandlers = append(b.allHandlers, sub)
	return sub.ID
}

func (b *EventBus) Unsubscribe(id string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.removeSubscription(id)
}

func (b *EventBus) removeSubscription(id string) {
	for eventType, subs := range b.subscriptions {
		filtered := make([]*Subscription, 0, len(subs))
		for _, sub := range subs {
			if sub.ID != id {
				filtered = append(filtered, sub)
			}
		}
		b.subscriptions[eventType] = filtered
	}
	filtered := make([]*Subscription, 0, len(b.allHandlers))
	for _, sub := range b.allHandlers {
		if sub.ID != id {
			filtered = append(filtered, sub)
		}
	}
	b.allHandlers = filtered
}

func (b *EventBus) Publish(event *Event) error {
	b.mu.RLock()
	running := b.running
	b.mu.RUnlock()
	if !running {
		return fmt.Errorf("event bus not running")
	}
	select {
	case b.eventCh <- event:
		return nil
	default:
		b.metrics.mu.Lock()
		b.metrics.DroppedCount++
		b.metrics.mu.Unlock()
		return fmt.Errorf("event buffer full")
	}
}

func (b *EventBus) PublishSync(ctx context.Context, event *Event) error {
	b.processEvent(ctx, event)
	return nil
}

func (b *EventBus) Emit(eventType EventType, source string, data map[string]any) error {
	event := NewEvent(eventType, source)
	for k, v := range data {
		event.Data[k] = v
	}
	return b.Publish(event)
}

func (b *EventBus) Metrics() EventMetrics {
	b.metrics.mu.RLock()
	defer b.metrics.mu.RUnlock()
	byType := make(map[EventType]int64)
	for k, v := range b.metrics.EventsByType {
		byType[k] = v
	}
	return EventMetrics{
		TotalEvents:    b.metrics.TotalEvents,
		EventsByType:   byType,
		ErrorCount:     b.metrics.ErrorCount,
		DroppedCount:   b.metrics.DroppedCount,
		AvgProcessTime: b.metrics.AvgProcessTime,
		LastEventTime:  b.metrics.LastEventTime,
	}
}

func (b *EventBus) SubscriptionCount() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	count := len(b.allHandlers)
	for _, subs := range b.subscriptions {
		count += len(subs)
	}
	return count
}

type HookPoint string

const (
	HookBeforeInit     HookPoint = "before_init"
	HookAfterInit      HookPoint = "after_init"
	HookBeforeStart    HookPoint = "before_start"
	HookAfterStart     HookPoint = "after_start"
	HookBeforeStop     HookPoint = "before_stop"
	HookAfterStop      HookPoint = "after_stop"
	HookBeforeExecute  HookPoint = "before_execute"
	HookAfterExecute   HookPoint = "after_execute"
	HookOnError        HookPoint = "on_error"
	HookOnHealthChange HookPoint = "on_health_change"
)

type Hook struct {
	ID       string
	Point    HookPoint
	Handler  func(ctx context.Context, data map[string]any) error
	Priority int
	Enabled  bool
}

type HookManager struct {
	mu    sync.RWMutex
	hooks map[HookPoint][]*Hook
}

func NewHookManager() *HookManager {
	return &HookManager{hooks: make(map[HookPoint][]*Hook)}
}

func (m *HookManager) Register(point HookPoint, handler func(ctx context.Context, data map[string]any) error) string {
	hook := &Hook{
		ID:       generateHookID(),
		Point:    point,
		Handler:  handler,
		Priority: 0,
		Enabled:  true,
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.hooks[point] = append(m.hooks[point], hook)
	return hook.ID
}

func (m *HookManager) RegisterWithPriority(point HookPoint, handler func(ctx context.Context, data map[string]any) error, priority int) string {
	hook := &Hook{
		ID:       generateHookID(),
		Point:    point,
		Handler:  handler,
		Priority: priority,
		Enabled:  true,
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.hooks[point] = append(m.hooks[point], hook)
	return hook.ID
}

func (m *HookManager) Unregister(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for point, hooks := range m.hooks {
		filtered := make([]*Hook, 0, len(hooks))
		for _, h := range hooks {
			if h.ID != id {
				filtered = append(filtered, h)
			}
		}
		m.hooks[point] = filtered
	}
}

func (m *HookManager) Enable(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, hooks := range m.hooks {
		for _, h := range hooks {
			if h.ID == id {
				h.Enabled = true
				return
			}
		}
	}
}

func (m *HookManager) Disable(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, hooks := range m.hooks {
		for _, h := range hooks {
			if h.ID == id {
				h.Enabled = false
				return
			}
		}
	}
}

func (m *HookManager) Execute(ctx context.Context, point HookPoint, data map[string]any) error {
	m.mu.RLock()
	hooks := make([]*Hook, 0)
	if hs, ok := m.hooks[point]; ok {
		for _, h := range hs {
			if h.Enabled {
				hooks = append(hooks, h)
			}
		}
	}
	m.mu.RUnlock()
	sortHooksByPriority(hooks)
	for _, hook := range hooks {
		if err := hook.Handler(ctx, data); err != nil {
			return fmt.Errorf("hook %s failed: %w", hook.ID, err)
		}
	}
	return nil
}

func (m *HookManager) ExecuteAll(ctx context.Context, point HookPoint, data map[string]any) []error {
	m.mu.RLock()
	hooks := make([]*Hook, 0)
	if hs, ok := m.hooks[point]; ok {
		for _, h := range hs {
			if h.Enabled {
				hooks = append(hooks, h)
			}
		}
	}
	m.mu.RUnlock()
	sortHooksByPriority(hooks)
	var errors []error
	for _, hook := range hooks {
		if err := hook.Handler(ctx, data); err != nil {
			errors = append(errors, fmt.Errorf("hook %s: %w", hook.ID, err))
		}
	}
	return errors
}

func (m *HookManager) Count(point HookPoint) int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if hooks, ok := m.hooks[point]; ok {
		return len(hooks)
	}
	return 0
}

func (m *HookManager) Clear(point HookPoint) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.hooks, point)
}

func (m *HookManager) ClearAll() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.hooks = make(map[HookPoint][]*Hook)
}

var (
	eventIDCounter int64
	subIDCounter   int64
	hookIDCounter  int64
	idMu           sync.Mutex
)

func generateEventID() string {
	idMu.Lock()
	eventIDCounter++
	id := eventIDCounter
	idMu.Unlock()
	return fmt.Sprintf("evt_%d_%d", time.Now().UnixNano(), id)
}

func generateSubscriptionID() string {
	idMu.Lock()
	subIDCounter++
	id := subIDCounter
	idMu.Unlock()
	return fmt.Sprintf("sub_%d", id)
}

func generateHookID() string {
	idMu.Lock()
	hookIDCounter++
	id := hookIDCounter
	idMu.Unlock()
	return fmt.Sprintf("hook_%d", id)
}

func sortByPriority(subs []*Subscription) {
	for i := 0; i < len(subs)-1; i++ {
		for j := i + 1; j < len(subs); j++ {
			if subs[j].Priority > subs[i].Priority {
				subs[i], subs[j] = subs[j], subs[i]
			}
		}
	}
}

func sortHooksByPriority(hooks []*Hook) {
	for i := 0; i < len(hooks)-1; i++ {
		for j := i + 1; j < len(hooks); j++ {
			if hooks[j].Priority > hooks[i].Priority {
				hooks[i], hooks[j] = hooks[j], hooks[i]
			}
		}
	}
}
