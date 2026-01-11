package remote

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type ConnectionType string

const (
	ConnectionSSH        ConnectionType = "ssh"
	ConnectionDocker     ConnectionType = "docker"
	ConnectionKubernetes ConnectionType = "kubernetes"
	ConnectionLocal      ConnectionType = "local"
)

type ConnectionState string

const (
	StateDisconnected ConnectionState = "disconnected"
	StateConnecting   ConnectionState = "connecting"
	StateConnected    ConnectionState = "connected"
	StateError        ConnectionState = "error"
)

type RemoteHost struct {
	ID          string            `json:"id" yaml:"id"`
	Name        string            `json:"name" yaml:"name"`
	Type        ConnectionType    `json:"type" yaml:"type"`
	Host        string            `json:"host" yaml:"host"`
	Port        int               `json:"port" yaml:"port"`
	User        string            `json:"user" yaml:"user"`
	KeyPath     string            `json:"key_path" yaml:"key_path"`
	Password    string            `json:"-" yaml:"-"`
	Container   string            `json:"container" yaml:"container"`
	Image       string            `json:"image" yaml:"image"`
	Namespace   string            `json:"namespace" yaml:"namespace"`
	Pod         string            `json:"pod" yaml:"pod"`
	WorkDir     string            `json:"work_dir" yaml:"work_dir"`
	Environment map[string]string `json:"environment" yaml:"environment"`
	Labels      map[string]string `json:"labels" yaml:"labels"`
}

type RemoteConnection struct {
	Host        *RemoteHost
	State       ConnectionState
	Error       error
	ConnectedAt time.Time
	LastPingAt  time.Time
	Latency     time.Duration
	mu          sync.RWMutex
	cancel      context.CancelFunc
	stdout      io.ReadCloser
	stderr      io.ReadCloser
	stdin       io.WriteCloser
	cmd         *exec.Cmd
}

type ExecutionResult struct {
	ExitCode int
	Stdout   string
	Stderr   string
	Duration time.Duration
	Error    error
}

type StreamCallback func(stream string, data []byte)

type RemoteManager struct {
	hosts       map[string]*RemoteHost
	connections map[string]*RemoteConnection
	configPath  string
	mu          sync.RWMutex
}

func NewRemoteManager() *RemoteManager {
	homeDir, _ := os.UserHomeDir()
	configPath := filepath.Join(homeDir, ".superai", "remotes.json")

	m := &RemoteManager{
		hosts:       make(map[string]*RemoteHost),
		connections: make(map[string]*RemoteConnection),
		configPath:  configPath,
	}

	m.loadConfig()
	return m
}

func (m *RemoteManager) loadConfig() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	data, err := os.ReadFile(m.configPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	var hosts []*RemoteHost
	if err := json.Unmarshal(data, &hosts); err != nil {
		return err
	}

	for _, h := range hosts {
		m.hosts[h.ID] = h
	}
	return nil
}

func (m *RemoteManager) SaveConfig() error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	hosts := make([]*RemoteHost, 0, len(m.hosts))
	for _, h := range m.hosts {
		hosts = append(hosts, h)
	}

	data, err := json.MarshalIndent(hosts, "", "  ")
	if err != nil {
		return err
	}

	dir := filepath.Dir(m.configPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	return os.WriteFile(m.configPath, data, 0644)
}

func (m *RemoteManager) AddHost(host *RemoteHost) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if host.ID == "" {
		host.ID = fmt.Sprintf("%s-%d", host.Type, time.Now().UnixNano())
	}
	if host.Port == 0 {
		switch host.Type {
		case ConnectionSSH:
			host.Port = 22
		case ConnectionDocker:
			host.Port = 2375
		}
	}

	m.hosts[host.ID] = host
	return nil
}

func (m *RemoteManager) RemoveHost(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if conn, exists := m.connections[id]; exists {
		conn.Close()
		delete(m.connections, id)
	}

	delete(m.hosts, id)
	return nil
}

func (m *RemoteManager) GetHost(id string) *RemoteHost {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.hosts[id]
}

func (m *RemoteManager) ListHosts() []*RemoteHost {
	m.mu.RLock()
	defer m.mu.RUnlock()

	hosts := make([]*RemoteHost, 0, len(m.hosts))
	for _, h := range m.hosts {
		hosts = append(hosts, h)
	}
	return hosts
}

func (m *RemoteManager) Connect(ctx context.Context, hostID string) (*RemoteConnection, error) {
	host := m.GetHost(hostID)
	if host == nil {
		return nil, fmt.Errorf("host not found: %s", hostID)
	}

	m.mu.Lock()
	if conn, exists := m.connections[hostID]; exists && conn.State == StateConnected {
		m.mu.Unlock()
		return conn, nil
	}

	conn := &RemoteConnection{
		Host:  host,
		State: StateConnecting,
	}
	m.connections[hostID] = conn
	m.mu.Unlock()

	var err error
	switch host.Type {
	case ConnectionSSH:
		err = conn.connectSSH(ctx)
	case ConnectionDocker:
		err = conn.connectDocker(ctx)
	case ConnectionKubernetes:
		err = conn.connectKubernetes(ctx)
	case ConnectionLocal:
		conn.State = StateConnected
		conn.ConnectedAt = time.Now()
	default:
		err = fmt.Errorf("unsupported connection type: %s", host.Type)
	}

	if err != nil {
		conn.mu.Lock()
		conn.State = StateError
		conn.Error = err
		conn.mu.Unlock()
		return nil, err
	}

	return conn, nil
}

func (m *RemoteManager) Disconnect(hostID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	conn, exists := m.connections[hostID]
	if !exists {
		return nil
	}

	conn.Close()
	delete(m.connections, hostID)
	return nil
}

func (m *RemoteManager) GetConnection(hostID string) *RemoteConnection {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.connections[hostID]
}

func (m *RemoteManager) Execute(ctx context.Context, hostID string, command string) (*ExecutionResult, error) {
	conn, err := m.Connect(ctx, hostID)
	if err != nil {
		return nil, err
	}

	return conn.Execute(ctx, command)
}

func (m *RemoteManager) ExecuteStream(ctx context.Context, hostID string, command string, callback StreamCallback) (*ExecutionResult, error) {
	conn, err := m.Connect(ctx, hostID)
	if err != nil {
		return nil, err
	}

	return conn.ExecuteStream(ctx, command, callback)
}

func (m *RemoteManager) Ping(ctx context.Context, hostID string) (time.Duration, error) {
	conn, err := m.Connect(ctx, hostID)
	if err != nil {
		return 0, err
	}

	return conn.Ping(ctx)
}

func (m *RemoteManager) Stats() map[string]ConnectionState {
	m.mu.RLock()
	defer m.mu.RUnlock()

	stats := make(map[string]ConnectionState)
	for id, conn := range m.connections {
		conn.mu.RLock()
		stats[id] = conn.State
		conn.mu.RUnlock()
	}
	return stats
}

func (c *RemoteConnection) connectSSH(ctx context.Context) error {
	host := c.Host

	args := []string{}
	if host.KeyPath != "" {
		args = append(args, "-i", host.KeyPath)
	}
	args = append(args, "-o", "StrictHostKeyChecking=no")
	args = append(args, "-o", "ConnectTimeout=10")
	args = append(args, "-p", fmt.Sprintf("%d", host.Port))

	target := host.Host
	if host.User != "" {
		target = fmt.Sprintf("%s@%s", host.User, host.Host)
	}
	args = append(args, target)

	connCtx, cancel := context.WithCancel(ctx)
	c.cancel = cancel

	c.cmd = exec.CommandContext(connCtx, "ssh", args...)

	var err error
	c.stdin, err = c.cmd.StdinPipe()
	if err != nil {
		return fmt.Errorf("stdin pipe: %w", err)
	}

	c.stdout, err = c.cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("stdout pipe: %w", err)
	}

	c.stderr, err = c.cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("stderr pipe: %w", err)
	}

	if err := c.cmd.Start(); err != nil {
		return fmt.Errorf("ssh start: %w", err)
	}

	c.mu.Lock()
	c.State = StateConnected
	c.ConnectedAt = time.Now()
	c.mu.Unlock()

	return nil
}

func (c *RemoteConnection) connectDocker(ctx context.Context) error {
	host := c.Host

	args := []string{"exec", "-i"}
	if host.WorkDir != "" {
		args = append(args, "-w", host.WorkDir)
	}
	for k, v := range host.Environment {
		args = append(args, "-e", fmt.Sprintf("%s=%s", k, v))
	}
	args = append(args, host.Container, "sh")

	connCtx, cancel := context.WithCancel(ctx)
	c.cancel = cancel

	c.cmd = exec.CommandContext(connCtx, "docker", args...)

	var err error
	c.stdin, err = c.cmd.StdinPipe()
	if err != nil {
		return fmt.Errorf("stdin pipe: %w", err)
	}

	c.stdout, err = c.cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("stdout pipe: %w", err)
	}

	c.stderr, err = c.cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("stderr pipe: %w", err)
	}

	if err := c.cmd.Start(); err != nil {
		return fmt.Errorf("docker start: %w", err)
	}

	c.mu.Lock()
	c.State = StateConnected
	c.ConnectedAt = time.Now()
	c.mu.Unlock()

	return nil
}

func (c *RemoteConnection) connectKubernetes(ctx context.Context) error {
	host := c.Host

	args := []string{"exec", "-i"}
	if host.Namespace != "" {
		args = append(args, "-n", host.Namespace)
	}
	args = append(args, host.Pod)
	if host.Container != "" {
		args = append(args, "-c", host.Container)
	}
	args = append(args, "--", "sh")

	connCtx, cancel := context.WithCancel(ctx)
	c.cancel = cancel

	c.cmd = exec.CommandContext(connCtx, "kubectl", args...)

	var err error
	c.stdin, err = c.cmd.StdinPipe()
	if err != nil {
		return fmt.Errorf("stdin pipe: %w", err)
	}

	c.stdout, err = c.cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("stdout pipe: %w", err)
	}

	c.stderr, err = c.cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("stderr pipe: %w", err)
	}

	if err := c.cmd.Start(); err != nil {
		return fmt.Errorf("kubectl start: %w", err)
	}

	c.mu.Lock()
	c.State = StateConnected
	c.ConnectedAt = time.Now()
	c.mu.Unlock()

	return nil
}

func (c *RemoteConnection) Execute(ctx context.Context, command string) (*ExecutionResult, error) {
	c.mu.RLock()
	host := c.Host
	state := c.State
	c.mu.RUnlock()

	if state != StateConnected {
		return nil, fmt.Errorf("not connected")
	}

	start := time.Now()
	var result ExecutionResult

	switch host.Type {
	case ConnectionLocal:
		cmd := exec.CommandContext(ctx, "sh", "-c", command)
		if host.WorkDir != "" {
			cmd.Dir = host.WorkDir
		}
		for k, v := range host.Environment {
			cmd.Env = append(cmd.Env, fmt.Sprintf("%s=%s", k, v))
		}

		stdout, err := cmd.Output()
		result.Duration = time.Since(start)
		if err != nil {
			if exitErr, ok := err.(*exec.ExitError); ok {
				result.ExitCode = exitErr.ExitCode()
				result.Stderr = string(exitErr.Stderr)
			} else {
				result.Error = err
				return &result, nil
			}
		}
		result.Stdout = string(stdout)

	case ConnectionSSH, ConnectionDocker, ConnectionKubernetes:
		marker := fmt.Sprintf("__SUPERAI_EXIT_%d__", time.Now().UnixNano())
		wrappedCmd := fmt.Sprintf("%s; echo %s$?\n", command, marker)

		if _, err := c.stdin.Write([]byte(wrappedCmd)); err != nil {
			return nil, fmt.Errorf("write command: %w", err)
		}

		var stdoutBuf, stderrBuf strings.Builder
		done := make(chan struct{})

		go func() {
			scanner := bufio.NewScanner(c.stdout)
			for scanner.Scan() {
				line := scanner.Text()
				if strings.HasPrefix(line, marker) {
					fmt.Sscanf(strings.TrimPrefix(line, marker), "%d", &result.ExitCode)
					close(done)
					return
				}
				stdoutBuf.WriteString(line + "\n")
			}
		}()

		go func() {
			scanner := bufio.NewScanner(c.stderr)
			for scanner.Scan() {
				stderrBuf.WriteString(scanner.Text() + "\n")
			}
		}()

		select {
		case <-done:
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(5 * time.Minute):
			return nil, fmt.Errorf("command timeout")
		}

		result.Stdout = stdoutBuf.String()
		result.Stderr = stderrBuf.String()
		result.Duration = time.Since(start)
	}

	return &result, nil
}

func (c *RemoteConnection) ExecuteStream(ctx context.Context, command string, callback StreamCallback) (*ExecutionResult, error) {
	c.mu.RLock()
	host := c.Host
	state := c.State
	c.mu.RUnlock()

	if state != StateConnected {
		return nil, fmt.Errorf("not connected")
	}

	start := time.Now()
	var result ExecutionResult

	switch host.Type {
	case ConnectionLocal:
		cmd := exec.CommandContext(ctx, "sh", "-c", command)
		if host.WorkDir != "" {
			cmd.Dir = host.WorkDir
		}

		stdout, _ := cmd.StdoutPipe()
		stderr, _ := cmd.StderrPipe()

		if err := cmd.Start(); err != nil {
			return nil, err
		}

		var wg sync.WaitGroup
		wg.Add(2)

		go func() {
			defer wg.Done()
			buf := make([]byte, 4096)
			for {
				n, err := stdout.Read(buf)
				if n > 0 {
					callback("stdout", buf[:n])
				}
				if err != nil {
					break
				}
			}
		}()

		go func() {
			defer wg.Done()
			buf := make([]byte, 4096)
			for {
				n, err := stderr.Read(buf)
				if n > 0 {
					callback("stderr", buf[:n])
				}
				if err != nil {
					break
				}
			}
		}()

		wg.Wait()
		if err := cmd.Wait(); err != nil {
			if exitErr, ok := err.(*exec.ExitError); ok {
				result.ExitCode = exitErr.ExitCode()
			}
		}
		result.Duration = time.Since(start)

	default:
		return c.Execute(ctx, command)
	}

	return &result, nil
}

func (c *RemoteConnection) Ping(ctx context.Context) (time.Duration, error) {
	start := time.Now()
	result, err := c.Execute(ctx, "echo pong")
	if err != nil {
		return 0, err
	}
	if result.ExitCode != 0 {
		return 0, fmt.Errorf("ping failed: %s", result.Stderr)
	}

	latency := time.Since(start)
	c.mu.Lock()
	c.LastPingAt = time.Now()
	c.Latency = latency
	c.mu.Unlock()

	return latency, nil
}

func (c *RemoteConnection) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.cancel != nil {
		c.cancel()
	}

	if c.stdin != nil {
		c.stdin.Close()
	}
	if c.stdout != nil {
		c.stdout.Close()
	}
	if c.stderr != nil {
		c.stderr.Close()
	}

	if c.cmd != nil && c.cmd.Process != nil {
		c.cmd.Process.Kill()
	}

	c.State = StateDisconnected
	return nil
}

func (c *RemoteConnection) IsConnected() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.State == StateConnected
}

func (c *RemoteConnection) GetState() ConnectionState {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.State
}

func (c *RemoteConnection) GetLatency() time.Duration {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.Latency
}

func TestSSHConnection(host, user string, port int, keyPath string) error {
	args := []string{"-o", "BatchMode=yes", "-o", "ConnectTimeout=5"}
	if keyPath != "" {
		args = append(args, "-i", keyPath)
	}
	args = append(args, "-p", fmt.Sprintf("%d", port))
	target := host
	if user != "" {
		target = fmt.Sprintf("%s@%s", user, host)
	}
	args = append(args, target, "echo", "ok")

	cmd := exec.Command("ssh", args...)
	return cmd.Run()
}

func TestDockerConnection(container string) error {
	cmd := exec.Command("docker", "inspect", "--format", "{{.State.Running}}", container)
	output, err := cmd.Output()
	if err != nil {
		return err
	}
	if strings.TrimSpace(string(output)) != "true" {
		return fmt.Errorf("container not running")
	}
	return nil
}

func TestKubernetesConnection(namespace, pod string) error {
	args := []string{"get", "pod", pod, "-o", "jsonpath={.status.phase}"}
	if namespace != "" {
		args = append(args, "-n", namespace)
	}
	cmd := exec.Command("kubectl", args...)
	output, err := cmd.Output()
	if err != nil {
		return err
	}
	if strings.TrimSpace(string(output)) != "Running" {
		return fmt.Errorf("pod not running: %s", output)
	}
	return nil
}

func ListDockerContainers() ([]string, error) {
	cmd := exec.Command("docker", "ps", "--format", "{{.Names}}")
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	var containers []string
	for _, line := range lines {
		if line != "" {
			containers = append(containers, line)
		}
	}
	return containers, nil
}

func ListKubernetesPods(namespace string) ([]string, error) {
	args := []string{"get", "pods", "-o", "jsonpath={.items[*].metadata.name}"}
	if namespace != "" {
		args = append(args, "-n", namespace)
	}
	cmd := exec.Command("kubectl", args...)
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	return strings.Fields(string(output)), nil
}

func ResolveSSHConfig(alias string) (*RemoteHost, error) {
	homeDir, _ := os.UserHomeDir()
	configPath := filepath.Join(homeDir, ".ssh", "config")

	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, err
	}

	host := &RemoteHost{
		Type: ConnectionSSH,
		Port: 22,
	}

	lines := strings.Split(string(data), "\n")
	inHost := false

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(strings.ToLower(line), "host ") {
			hostPattern := strings.TrimSpace(strings.TrimPrefix(line, "Host "))
			hostPattern = strings.TrimSpace(strings.TrimPrefix(hostPattern, "host "))
			inHost = matchSSHPattern(hostPattern, alias)
			if inHost {
				host.Name = alias
				host.ID = alias
			}
			continue
		}

		if !inHost {
			continue
		}

		parts := strings.SplitN(line, " ", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.ToLower(strings.TrimSpace(parts[0]))
		value := strings.TrimSpace(parts[1])

		switch key {
		case "hostname":
			host.Host = value
		case "user":
			host.User = value
		case "port":
			fmt.Sscanf(value, "%d", &host.Port)
		case "identityfile":
			if strings.HasPrefix(value, "~") {
				value = filepath.Join(homeDir, value[1:])
			}
			host.KeyPath = value
		}
	}

	if host.Host == "" {
		host.Host = alias
	}

	return host, nil
}

func matchSSHPattern(pattern, alias string) bool {
	if pattern == "*" {
		return true
	}
	if strings.Contains(pattern, "*") {
		pattern = strings.ReplaceAll(pattern, "*", ".*")
		matched, _ := filepath.Match(pattern, alias)
		return matched
	}
	return pattern == alias
}

func IsPortOpen(host string, port int, timeout time.Duration) bool {
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:%d", host, port), timeout)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}
