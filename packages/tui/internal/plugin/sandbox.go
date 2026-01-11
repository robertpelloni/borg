package plugin

import (
	"context"
	"fmt"
	"runtime"
	"sync"
	"sync/atomic"
	"time"
)

type ResourceLimits struct {
	MaxMemoryMB         int64
	MaxCPUPercent       float64
	MaxGoroutines       int
	MaxFileHandles      int
	MaxNetConns         int
	ExecutionTimeoutSec int
	IOTimeoutSec        int
}

func DefaultResourceLimits() ResourceLimits {
	return ResourceLimits{
		MaxMemoryMB:         256,
		MaxCPUPercent:       50.0,
		MaxGoroutines:       100,
		MaxFileHandles:      50,
		MaxNetConns:         20,
		ExecutionTimeoutSec: 300,
		IOTimeoutSec:        30,
	}
}

type Permission string

const (
	PermissionFileRead   Permission = "file:read"
	PermissionFileWrite  Permission = "file:write"
	PermissionNetworkIn  Permission = "network:inbound"
	PermissionNetworkOut Permission = "network:outbound"
	PermissionExec       Permission = "exec:subprocess"
	PermissionEnvRead    Permission = "env:read"
	PermissionEnvWrite   Permission = "env:write"
	PermissionSystemInfo Permission = "system:info"
	PermissionPluginComm Permission = "plugin:communicate"
	PermissionUIAccess   Permission = "ui:access"
)

type SandboxConfig struct {
	Enabled          bool
	Limits           ResourceLimits
	Permissions      []Permission
	AllowedPaths     []string
	DeniedPaths      []string
	AllowedHosts     []string
	DeniedHosts      []string
	AllowedEnvVars   []string
	IsolateWorkDir   bool
	LogViolations    bool
	TerminateOnLimit bool
}

func DefaultSandboxConfig() SandboxConfig {
	return SandboxConfig{
		Enabled: true,
		Limits:  DefaultResourceLimits(),
		Permissions: []Permission{
			PermissionFileRead,
			PermissionNetworkOut,
			PermissionEnvRead,
			PermissionSystemInfo,
		},
		AllowedPaths:     []string{},
		DeniedPaths:      []string{"/etc/passwd", "/etc/shadow", "~/.ssh"},
		AllowedHosts:     []string{},
		DeniedHosts:      []string{},
		AllowedEnvVars:   []string{"PATH", "HOME", "USER", "LANG", "LC_ALL"},
		IsolateWorkDir:   true,
		LogViolations:    true,
		TerminateOnLimit: false,
	}
}

type ResourceUsage struct {
	MemoryBytes    int64
	GoroutineCount int
	FileHandles    int
	NetConns       int
	CPUTimeNs      int64
	LastUpdated    time.Time
}

type ViolationType int

const (
	ViolationMemoryLimit ViolationType = iota
	ViolationCPULimit
	ViolationGoroutineLimit
	ViolationFileHandleLimit
	ViolationNetConnLimit
	ViolationPermissionDenied
	ViolationPathDenied
	ViolationHostDenied
	ViolationTimeout
)

func (v ViolationType) String() string {
	switch v {
	case ViolationMemoryLimit:
		return "memory_limit"
	case ViolationCPULimit:
		return "cpu_limit"
	case ViolationGoroutineLimit:
		return "goroutine_limit"
	case ViolationFileHandleLimit:
		return "file_handle_limit"
	case ViolationNetConnLimit:
		return "net_conn_limit"
	case ViolationPermissionDenied:
		return "permission_denied"
	case ViolationPathDenied:
		return "path_denied"
	case ViolationHostDenied:
		return "host_denied"
	case ViolationTimeout:
		return "timeout"
	default:
		return "unknown"
	}
}

type Violation struct {
	Type       ViolationType
	Plugin     string
	Message    string
	Value      any
	Limit      any
	Timestamp  time.Time
	Terminated bool
}

type Sandbox struct {
	mu          sync.RWMutex
	pluginName  string
	config      SandboxConfig
	usage       ResourceUsage
	violations  []Violation
	running     atomic.Bool
	startTime   time.Time
	stopCh      chan struct{}
	violationCh chan Violation
}

func NewSandbox(pluginName string, config SandboxConfig) *Sandbox {
	return &Sandbox{
		pluginName:  pluginName,
		config:      config,
		violations:  make([]Violation, 0),
		stopCh:      make(chan struct{}),
		violationCh: make(chan Violation, 100),
	}
}

func (s *Sandbox) Violations() <-chan Violation {
	return s.violationCh
}

func (s *Sandbox) Start(ctx context.Context) error {
	if !s.config.Enabled {
		return nil
	}

	s.running.Store(true)
	s.startTime = time.Now()
	s.stopCh = make(chan struct{})

	go s.monitor(ctx)

	return nil
}

func (s *Sandbox) Stop() {
	if !s.running.Load() {
		return
	}
	s.running.Store(false)
	close(s.stopCh)
}

func (s *Sandbox) monitor(ctx context.Context) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-s.stopCh:
			return
		case <-ticker.C:
			s.checkLimits()
		}
	}
}

func (s *Sandbox) checkLimits() {
	s.mu.Lock()
	defer s.mu.Unlock()

	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	s.usage.MemoryBytes = int64(m.Alloc)
	s.usage.GoroutineCount = runtime.NumGoroutine()
	s.usage.LastUpdated = time.Now()

	if s.config.Limits.MaxMemoryMB > 0 {
		memMB := s.usage.MemoryBytes / (1024 * 1024)
		if memMB > s.config.Limits.MaxMemoryMB {
			s.recordViolation(ViolationMemoryLimit, memMB, s.config.Limits.MaxMemoryMB)
		}
	}

	if s.config.Limits.MaxGoroutines > 0 {
		if s.usage.GoroutineCount > s.config.Limits.MaxGoroutines {
			s.recordViolation(ViolationGoroutineLimit, s.usage.GoroutineCount, s.config.Limits.MaxGoroutines)
		}
	}

	if s.config.Limits.ExecutionTimeoutSec > 0 {
		elapsed := time.Since(s.startTime)
		if elapsed.Seconds() > float64(s.config.Limits.ExecutionTimeoutSec) {
			s.recordViolation(ViolationTimeout, elapsed.Seconds(), s.config.Limits.ExecutionTimeoutSec)
		}
	}
}

func (s *Sandbox) recordViolation(vType ViolationType, value, limit any) {
	v := Violation{
		Type:       vType,
		Plugin:     s.pluginName,
		Message:    fmt.Sprintf("%s exceeded: %v > %v", vType, value, limit),
		Value:      value,
		Limit:      limit,
		Timestamp:  time.Now(),
		Terminated: false,
	}

	if s.config.TerminateOnLimit {
		v.Terminated = true
	}

	s.violations = append(s.violations, v)

	select {
	case s.violationCh <- v:
	default:
	}

	if s.config.LogViolations {
	}
}

func (s *Sandbox) HasPermission(perm Permission) bool {
	if !s.config.Enabled {
		return true
	}

	for _, p := range s.config.Permissions {
		if p == perm {
			return true
		}
	}
	return false
}

func (s *Sandbox) CheckPermission(perm Permission) error {
	if s.HasPermission(perm) {
		return nil
	}

	s.mu.Lock()
	s.recordViolation(ViolationPermissionDenied, perm, s.config.Permissions)
	s.mu.Unlock()

	return fmt.Errorf("permission denied: %s", perm)
}

func (s *Sandbox) IsPathAllowed(path string) bool {
	if !s.config.Enabled {
		return true
	}

	for _, denied := range s.config.DeniedPaths {
		if matchPath(path, denied) {
			return false
		}
	}

	if len(s.config.AllowedPaths) == 0 {
		return true
	}

	for _, allowed := range s.config.AllowedPaths {
		if matchPath(path, allowed) {
			return true
		}
	}

	return false
}

func (s *Sandbox) CheckPath(path string) error {
	if s.IsPathAllowed(path) {
		return nil
	}

	s.mu.Lock()
	s.recordViolation(ViolationPathDenied, path, s.config.AllowedPaths)
	s.mu.Unlock()

	return fmt.Errorf("path access denied: %s", path)
}

func (s *Sandbox) IsHostAllowed(host string) bool {
	if !s.config.Enabled {
		return true
	}

	for _, denied := range s.config.DeniedHosts {
		if matchHost(host, denied) {
			return false
		}
	}

	if len(s.config.AllowedHosts) == 0 {
		return true
	}

	for _, allowed := range s.config.AllowedHosts {
		if matchHost(host, allowed) {
			return true
		}
	}

	return false
}

func (s *Sandbox) CheckHost(host string) error {
	if s.IsHostAllowed(host) {
		return nil
	}

	s.mu.Lock()
	s.recordViolation(ViolationHostDenied, host, s.config.AllowedHosts)
	s.mu.Unlock()

	return fmt.Errorf("host access denied: %s", host)
}

func (s *Sandbox) IsEnvVarAllowed(name string) bool {
	if !s.config.Enabled {
		return true
	}

	for _, allowed := range s.config.AllowedEnvVars {
		if allowed == name || allowed == "*" {
			return true
		}
	}
	return false
}

func (s *Sandbox) IncrementFileHandles() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.config.Limits.MaxFileHandles > 0 && s.usage.FileHandles >= s.config.Limits.MaxFileHandles {
		s.recordViolation(ViolationFileHandleLimit, s.usage.FileHandles, s.config.Limits.MaxFileHandles)
		return fmt.Errorf("file handle limit exceeded")
	}

	s.usage.FileHandles++
	return nil
}

func (s *Sandbox) DecrementFileHandles() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.usage.FileHandles > 0 {
		s.usage.FileHandles--
	}
}

func (s *Sandbox) IncrementNetConns() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.config.Limits.MaxNetConns > 0 && s.usage.NetConns >= s.config.Limits.MaxNetConns {
		s.recordViolation(ViolationNetConnLimit, s.usage.NetConns, s.config.Limits.MaxNetConns)
		return fmt.Errorf("network connection limit exceeded")
	}

	s.usage.NetConns++
	return nil
}

func (s *Sandbox) DecrementNetConns() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.usage.NetConns > 0 {
		s.usage.NetConns--
	}
}

func (s *Sandbox) Usage() ResourceUsage {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.usage
}

func (s *Sandbox) GetViolations() []Violation {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]Violation, len(s.violations))
	copy(result, s.violations)
	return result
}

func (s *Sandbox) ViolationCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.violations)
}

func (s *Sandbox) ClearViolations() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.violations = make([]Violation, 0)
}

func (s *Sandbox) Stats() map[string]any {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return map[string]any{
		"plugin":       s.pluginName,
		"enabled":      s.config.Enabled,
		"running":      s.running.Load(),
		"memory_bytes": s.usage.MemoryBytes,
		"goroutines":   s.usage.GoroutineCount,
		"file_handles": s.usage.FileHandles,
		"net_conns":    s.usage.NetConns,
		"violations":   len(s.violations),
		"permissions":  len(s.config.Permissions),
		"uptime":       time.Since(s.startTime).String(),
	}
}

func matchPath(path, pattern string) bool {
	if pattern == path {
		return true
	}
	if len(pattern) > 0 && pattern[len(pattern)-1] == '*' {
		prefix := pattern[:len(pattern)-1]
		return len(path) >= len(prefix) && path[:len(prefix)] == prefix
	}
	return false
}

func matchHost(host, pattern string) bool {
	if pattern == host {
		return true
	}
	if len(pattern) > 0 && pattern[0] == '*' {
		suffix := pattern[1:]
		return len(host) >= len(suffix) && host[len(host)-len(suffix):] == suffix
	}
	return false
}

type SandboxManager struct {
	mu        sync.RWMutex
	sandboxes map[string]*Sandbox
	config    SandboxConfig
}

func NewSandboxManager(config SandboxConfig) *SandboxManager {
	return &SandboxManager{
		sandboxes: make(map[string]*Sandbox),
		config:    config,
	}
}

func (m *SandboxManager) Create(pluginName string) *Sandbox {
	m.mu.Lock()
	defer m.mu.Unlock()

	sandbox := NewSandbox(pluginName, m.config)
	m.sandboxes[pluginName] = sandbox
	return sandbox
}

func (m *SandboxManager) CreateWithConfig(pluginName string, config SandboxConfig) *Sandbox {
	m.mu.Lock()
	defer m.mu.Unlock()

	sandbox := NewSandbox(pluginName, config)
	m.sandboxes[pluginName] = sandbox
	return sandbox
}

func (m *SandboxManager) Get(pluginName string) *Sandbox {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.sandboxes[pluginName]
}

func (m *SandboxManager) Remove(pluginName string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if sandbox, exists := m.sandboxes[pluginName]; exists {
		sandbox.Stop()
		delete(m.sandboxes, pluginName)
	}
}

func (m *SandboxManager) StartAll(ctx context.Context) error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, sandbox := range m.sandboxes {
		if err := sandbox.Start(ctx); err != nil {
			return err
		}
	}
	return nil
}

func (m *SandboxManager) StopAll() {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, sandbox := range m.sandboxes {
		sandbox.Stop()
	}
}

func (m *SandboxManager) List() []*Sandbox {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]*Sandbox, 0, len(m.sandboxes))
	for _, s := range m.sandboxes {
		result = append(result, s)
	}
	return result
}

func (m *SandboxManager) AllViolations() map[string][]Violation {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make(map[string][]Violation)
	for name, sandbox := range m.sandboxes {
		result[name] = sandbox.GetViolations()
	}
	return result
}

func (m *SandboxManager) TotalViolations() int {
	m.mu.RLock()
	defer m.mu.RUnlock()

	total := 0
	for _, sandbox := range m.sandboxes {
		total += sandbox.ViolationCount()
	}
	return total
}
