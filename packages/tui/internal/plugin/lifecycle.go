package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

type LifecycleState int

const (
	StateUninitialized LifecycleState = iota
	StateInitializing
	StateInitialized
	StateStarting
	StateRunning
	StateStopping
	StateStopped
	StateError
	StateDegraded
)

func (s LifecycleState) String() string {
	switch s {
	case StateUninitialized:
		return "uninitialized"
	case StateInitializing:
		return "initializing"
	case StateInitialized:
		return "initialized"
	case StateStarting:
		return "starting"
	case StateRunning:
		return "running"
	case StateStopping:
		return "stopping"
	case StateStopped:
		return "stopped"
	case StateError:
		return "error"
	case StateDegraded:
		return "degraded"
	default:
		return "unknown"
	}
}

func (s LifecycleState) IsHealthy() bool {
	return s == StateRunning || s == StateInitialized
}

func (s LifecycleState) CanTransitionTo(target LifecycleState) bool {
	transitions := map[LifecycleState][]LifecycleState{
		StateUninitialized: {StateInitializing},
		StateInitializing:  {StateInitialized, StateError},
		StateInitialized:   {StateStarting, StateStopped},
		StateStarting:      {StateRunning, StateError},
		StateRunning:       {StateStopping, StateError, StateDegraded},
		StateStopping:      {StateStopped, StateError},
		StateStopped:       {StateInitializing, StateUninitialized},
		StateError:         {StateInitializing, StateUninitialized},
		StateDegraded:      {StateRunning, StateStopping, StateError},
	}

	allowed, ok := transitions[s]
	if !ok {
		return false
	}
	for _, t := range allowed {
		if t == target {
			return true
		}
	}
	return false
}

type HealthStatus int

const (
	HealthUnknown HealthStatus = iota
	HealthHealthy
	HealthDegraded
	HealthUnhealthy
)

func (h HealthStatus) String() string {
	switch h {
	case HealthUnknown:
		return "unknown"
	case HealthHealthy:
		return "healthy"
	case HealthDegraded:
		return "degraded"
	case HealthUnhealthy:
		return "unhealthy"
	default:
		return "unknown"
	}
}

type HealthCheck struct {
	Status      HealthStatus
	Message     string
	LastCheck   time.Time
	LastHealthy time.Time
	CheckCount  int64
	FailCount   int64
	Details     map[string]any
}

type HealthCheckFunc func(ctx context.Context) HealthCheck

type LifecycleHook func(ctx context.Context, pluginName string, state LifecycleState) error

type LifecycleConfig struct {
	InitTimeout      time.Duration
	StartTimeout     time.Duration
	StopTimeout      time.Duration
	HealthInterval   time.Duration
	HealthTimeout    time.Duration
	MaxHealthFails   int
	GracefulShutdown bool
	RetryOnError     bool
	MaxRetries       int
	RetryDelay       time.Duration
}

func DefaultLifecycleConfig() LifecycleConfig {
	return LifecycleConfig{
		InitTimeout:      30 * time.Second,
		StartTimeout:     30 * time.Second,
		StopTimeout:      15 * time.Second,
		HealthInterval:   30 * time.Second,
		HealthTimeout:    5 * time.Second,
		MaxHealthFails:   3,
		GracefulShutdown: true,
		RetryOnError:     true,
		MaxRetries:       3,
		RetryDelay:       time.Second,
	}
}

type PluginLifecycle struct {
	mu            sync.RWMutex
	pluginName    string
	state         LifecycleState
	health        HealthCheck
	config        LifecycleConfig
	plugin        Plugin
	pluginConfig  json.RawMessage
	healthFunc    HealthCheckFunc
	preInitHook   LifecycleHook
	postInitHook  LifecycleHook
	preStartHook  LifecycleHook
	postStartHook LifecycleHook
	preStopHook   LifecycleHook
	postStopHook  LifecycleHook
	errorHook     LifecycleHook
	stopHealthCh  chan struct{}
	errorCount    int
	lastError     error
	startedAt     time.Time
	stoppedAt     time.Time
}

func NewPluginLifecycle(pluginName string, plugin Plugin, config LifecycleConfig) *PluginLifecycle {
	return &PluginLifecycle{
		pluginName:   pluginName,
		plugin:       plugin,
		config:       config,
		state:        StateUninitialized,
		health:       HealthCheck{Status: HealthUnknown},
		stopHealthCh: make(chan struct{}),
	}
}

func (l *PluginLifecycle) SetConfig(config json.RawMessage) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.pluginConfig = config
}

func (l *PluginLifecycle) SetHealthCheck(fn HealthCheckFunc) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.healthFunc = fn
}

func (l *PluginLifecycle) SetPreInitHook(hook LifecycleHook) {
	l.mu.Lock()
	l.preInitHook = hook
	l.mu.Unlock()
}
func (l *PluginLifecycle) SetPostInitHook(hook LifecycleHook) {
	l.mu.Lock()
	l.postInitHook = hook
	l.mu.Unlock()
}
func (l *PluginLifecycle) SetPreStartHook(hook LifecycleHook) {
	l.mu.Lock()
	l.preStartHook = hook
	l.mu.Unlock()
}
func (l *PluginLifecycle) SetPostStartHook(hook LifecycleHook) {
	l.mu.Lock()
	l.postStartHook = hook
	l.mu.Unlock()
}
func (l *PluginLifecycle) SetPreStopHook(hook LifecycleHook) {
	l.mu.Lock()
	l.preStopHook = hook
	l.mu.Unlock()
}
func (l *PluginLifecycle) SetPostStopHook(hook LifecycleHook) {
	l.mu.Lock()
	l.postStopHook = hook
	l.mu.Unlock()
}
func (l *PluginLifecycle) SetErrorHook(hook LifecycleHook) {
	l.mu.Lock()
	l.errorHook = hook
	l.mu.Unlock()
}

func (l *PluginLifecycle) State() LifecycleState {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.state
}

func (l *PluginLifecycle) Health() HealthCheck {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.health
}

func (l *PluginLifecycle) LastError() error {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.lastError
}

func (l *PluginLifecycle) transition(target LifecycleState) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	if !l.state.CanTransitionTo(target) {
		return fmt.Errorf("invalid state transition: %s -> %s", l.state, target)
	}
	l.state = target
	return nil
}

func (l *PluginLifecycle) setError(err error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.lastError = err
	l.errorCount++
	l.state = StateError
}

func (l *PluginLifecycle) runHook(ctx context.Context, hook LifecycleHook, state LifecycleState) error {
	if hook == nil {
		return nil
	}
	return hook(ctx, l.pluginName, state)
}

func (l *PluginLifecycle) Init(ctx context.Context) error {
	if err := l.transition(StateInitializing); err != nil {
		return err
	}

	l.mu.RLock()
	preHook := l.preInitHook
	postHook := l.postInitHook
	errorHook := l.errorHook
	config := l.pluginConfig
	l.mu.RUnlock()

	if err := l.runHook(ctx, preHook, StateInitializing); err != nil {
		l.setError(err)
		_ = l.runHook(ctx, errorHook, StateError)
		return fmt.Errorf("pre-init hook failed: %w", err)
	}

	initCtx, cancel := context.WithTimeout(ctx, l.config.InitTimeout)
	defer cancel()

	if err := l.plugin.Init(initCtx, config); err != nil {
		l.setError(err)
		_ = l.runHook(ctx, errorHook, StateError)
		return fmt.Errorf("plugin init failed: %w", err)
	}

	if err := l.transition(StateInitialized); err != nil {
		return err
	}

	if err := l.runHook(ctx, postHook, StateInitialized); err != nil {
		l.setError(err)
		_ = l.runHook(ctx, errorHook, StateError)
		return fmt.Errorf("post-init hook failed: %w", err)
	}

	return nil
}

func (l *PluginLifecycle) Start(ctx context.Context) error {
	if err := l.transition(StateStarting); err != nil {
		return err
	}

	l.mu.RLock()
	preHook := l.preStartHook
	postHook := l.postStartHook
	errorHook := l.errorHook
	l.mu.RUnlock()

	if err := l.runHook(ctx, preHook, StateStarting); err != nil {
		l.setError(err)
		_ = l.runHook(ctx, errorHook, StateError)
		return fmt.Errorf("pre-start hook failed: %w", err)
	}

	startCtx, cancel := context.WithTimeout(ctx, l.config.StartTimeout)
	defer cancel()

	if err := l.plugin.Start(startCtx); err != nil {
		l.setError(err)
		_ = l.runHook(ctx, errorHook, StateError)
		return fmt.Errorf("plugin start failed: %w", err)
	}

	if err := l.transition(StateRunning); err != nil {
		return err
	}

	l.mu.Lock()
	l.startedAt = time.Now()
	l.stopHealthCh = make(chan struct{})
	l.mu.Unlock()

	go l.runHealthChecks(ctx)

	if err := l.runHook(ctx, postHook, StateRunning); err != nil {
		l.setError(err)
		_ = l.runHook(ctx, errorHook, StateError)
		return fmt.Errorf("post-start hook failed: %w", err)
	}

	return nil
}

func (l *PluginLifecycle) Stop(ctx context.Context) error {
	l.mu.RLock()
	currentState := l.state
	l.mu.RUnlock()

	if currentState == StateStopped || currentState == StateUninitialized {
		return nil
	}

	if err := l.transition(StateStopping); err != nil {
		return err
	}

	l.mu.Lock()
	close(l.stopHealthCh)
	l.mu.Unlock()

	l.mu.RLock()
	preHook := l.preStopHook
	postHook := l.postStopHook
	errorHook := l.errorHook
	l.mu.RUnlock()

	if err := l.runHook(ctx, preHook, StateStopping); err != nil {
		l.setError(err)
		_ = l.runHook(ctx, errorHook, StateError)
		return fmt.Errorf("pre-stop hook failed: %w", err)
	}

	stopCtx, cancel := context.WithTimeout(ctx, l.config.StopTimeout)
	defer cancel()

	if err := l.plugin.Stop(stopCtx); err != nil {
		l.setError(err)
		_ = l.runHook(ctx, errorHook, StateError)
		return fmt.Errorf("plugin stop failed: %w", err)
	}

	if err := l.transition(StateStopped); err != nil {
		return err
	}

	l.mu.Lock()
	l.stoppedAt = time.Now()
	l.mu.Unlock()

	if err := l.runHook(ctx, postHook, StateStopped); err != nil {
		return fmt.Errorf("post-stop hook failed: %w", err)
	}

	return nil
}

func (l *PluginLifecycle) Restart(ctx context.Context) error {
	if err := l.Stop(ctx); err != nil {
		return fmt.Errorf("restart stop failed: %w", err)
	}

	l.mu.Lock()
	l.state = StateInitialized
	l.mu.Unlock()

	if err := l.Start(ctx); err != nil {
		return fmt.Errorf("restart start failed: %w", err)
	}

	return nil
}

func (l *PluginLifecycle) runHealthChecks(ctx context.Context) {
	l.mu.RLock()
	healthFunc := l.healthFunc
	stopCh := l.stopHealthCh
	l.mu.RUnlock()

	if healthFunc == nil {
		return
	}

	ticker := time.NewTicker(l.config.HealthInterval)
	defer ticker.Stop()

	consecutiveFails := 0

	for {
		select {
		case <-ctx.Done():
			return
		case <-stopCh:
			return
		case <-ticker.C:
			healthCtx, cancel := context.WithTimeout(ctx, l.config.HealthTimeout)
			check := healthFunc(healthCtx)
			cancel()

			l.mu.Lock()
			l.health = check
			l.health.CheckCount++
			l.health.LastCheck = time.Now()

			if check.Status == HealthHealthy {
				l.health.LastHealthy = time.Now()
				consecutiveFails = 0
				if l.state == StateDegraded {
					l.state = StateRunning
				}
			} else {
				l.health.FailCount++
				consecutiveFails++
				if consecutiveFails >= l.config.MaxHealthFails && l.state == StateRunning {
					l.state = StateDegraded
				}
			}
			l.mu.Unlock()
		}
	}
}

func (l *PluginLifecycle) CheckHealth(ctx context.Context) HealthCheck {
	l.mu.RLock()
	healthFunc := l.healthFunc
	l.mu.RUnlock()

	if healthFunc == nil {
		return HealthCheck{
			Status:    HealthUnknown,
			Message:   "no health check configured",
			LastCheck: time.Now(),
		}
	}

	healthCtx, cancel := context.WithTimeout(ctx, l.config.HealthTimeout)
	defer cancel()

	check := healthFunc(healthCtx)
	check.LastCheck = time.Now()

	l.mu.Lock()
	l.health = check
	l.health.CheckCount++
	if check.Status == HealthHealthy {
		l.health.LastHealthy = time.Now()
	} else {
		l.health.FailCount++
	}
	l.mu.Unlock()

	return check
}

func (l *PluginLifecycle) Uptime() time.Duration {
	l.mu.RLock()
	defer l.mu.RUnlock()

	if l.startedAt.IsZero() {
		return 0
	}
	if l.state == StateRunning || l.state == StateDegraded {
		return time.Since(l.startedAt)
	}
	if !l.stoppedAt.IsZero() {
		return l.stoppedAt.Sub(l.startedAt)
	}
	return 0
}

func (l *PluginLifecycle) Stats() map[string]any {
	l.mu.RLock()
	defer l.mu.RUnlock()

	return map[string]any{
		"plugin_name":    l.pluginName,
		"state":          l.state.String(),
		"health_status":  l.health.Status.String(),
		"health_message": l.health.Message,
		"last_check":     l.health.LastCheck,
		"last_healthy":   l.health.LastHealthy,
		"check_count":    l.health.CheckCount,
		"fail_count":     l.health.FailCount,
		"error_count":    l.errorCount,
		"started_at":     l.startedAt,
		"stopped_at":     l.stoppedAt,
		"uptime":         l.Uptime().String(),
	}
}

type LifecycleManager struct {
	mu         sync.RWMutex
	lifecycles map[string]*PluginLifecycle
	config     LifecycleConfig
}

func NewLifecycleManager(config LifecycleConfig) *LifecycleManager {
	return &LifecycleManager{
		lifecycles: make(map[string]*PluginLifecycle),
		config:     config,
	}
}

func (m *LifecycleManager) Register(name string, plugin Plugin) *PluginLifecycle {
	m.mu.Lock()
	defer m.mu.Unlock()

	lc := NewPluginLifecycle(name, plugin, m.config)
	m.lifecycles[name] = lc
	return lc
}

func (m *LifecycleManager) Unregister(name string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.lifecycles, name)
}

func (m *LifecycleManager) Get(name string) *PluginLifecycle {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.lifecycles[name]
}

func (m *LifecycleManager) List() []*PluginLifecycle {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]*PluginLifecycle, 0, len(m.lifecycles))
	for _, lc := range m.lifecycles {
		result = append(result, lc)
	}
	return result
}

func (m *LifecycleManager) InitAll(ctx context.Context) error {
	m.mu.RLock()
	lifecycles := make([]*PluginLifecycle, 0, len(m.lifecycles))
	for _, lc := range m.lifecycles {
		lifecycles = append(lifecycles, lc)
	}
	m.mu.RUnlock()

	var errors []error
	for _, lc := range lifecycles {
		if err := lc.Init(ctx); err != nil {
			errors = append(errors, fmt.Errorf("%s: %w", lc.pluginName, err))
		}
	}

	if len(errors) > 0 {
		return fmt.Errorf("failed to init %d plugins", len(errors))
	}
	return nil
}

func (m *LifecycleManager) StartAll(ctx context.Context) error {
	m.mu.RLock()
	lifecycles := make([]*PluginLifecycle, 0, len(m.lifecycles))
	for _, lc := range m.lifecycles {
		lifecycles = append(lifecycles, lc)
	}
	m.mu.RUnlock()

	var errors []error
	for _, lc := range lifecycles {
		if lc.State() == StateInitialized {
			if err := lc.Start(ctx); err != nil {
				errors = append(errors, fmt.Errorf("%s: %w", lc.pluginName, err))
			}
		}
	}

	if len(errors) > 0 {
		return fmt.Errorf("failed to start %d plugins", len(errors))
	}
	return nil
}

func (m *LifecycleManager) StopAll(ctx context.Context) error {
	m.mu.RLock()
	lifecycles := make([]*PluginLifecycle, 0, len(m.lifecycles))
	for _, lc := range m.lifecycles {
		lifecycles = append(lifecycles, lc)
	}
	m.mu.RUnlock()

	var errors []error
	for _, lc := range lifecycles {
		if lc.State() == StateRunning || lc.State() == StateDegraded {
			if err := lc.Stop(ctx); err != nil {
				errors = append(errors, fmt.Errorf("%s: %w", lc.pluginName, err))
			}
		}
	}

	if len(errors) > 0 {
		return fmt.Errorf("failed to stop %d plugins", len(errors))
	}
	return nil
}

func (m *LifecycleManager) HealthSummary() map[string]HealthCheck {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make(map[string]HealthCheck, len(m.lifecycles))
	for name, lc := range m.lifecycles {
		result[name] = lc.Health()
	}
	return result
}

func (m *LifecycleManager) StateSummary() map[string]LifecycleState {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make(map[string]LifecycleState, len(m.lifecycles))
	for name, lc := range m.lifecycles {
		result[name] = lc.State()
	}
	return result
}
