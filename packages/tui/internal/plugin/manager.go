package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"plugin"
	"sync"
)

type Manager struct {
	mu        sync.RWMutex
	plugins   map[string]*LoadedPlugin
	pluginDir string
	configDir string
}

func NewManager(configDir string) *Manager {
	return &Manager{
		plugins:   make(map[string]*LoadedPlugin),
		pluginDir: filepath.Join(configDir, "plugins"),
		configDir: configDir,
	}
}

func (m *Manager) PluginDir() string {
	return m.pluginDir
}

func (m *Manager) EnsurePluginDir() error {
	return os.MkdirAll(m.pluginDir, 0755)
}

func (m *Manager) Discover() ([]string, error) {
	if err := m.EnsurePluginDir(); err != nil {
		return nil, fmt.Errorf("failed to create plugin directory: %w", err)
	}

	entries, err := os.ReadDir(m.pluginDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read plugin directory: %w", err)
	}

	var plugins []string
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		ext := filepath.Ext(entry.Name())
		if ext == ".so" || ext == ".dll" || ext == ".dylib" {
			plugins = append(plugins, filepath.Join(m.pluginDir, entry.Name()))
		}
	}

	return plugins, nil
}

func (m *Manager) Load(path string) (*LoadedPlugin, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if existing, ok := m.plugins[path]; ok {
		return existing, nil
	}

	p, err := plugin.Open(path)
	if err != nil {
		loaded := &LoadedPlugin{
			Path:  path,
			State: PluginStateError,
			Error: fmt.Errorf("failed to open plugin: %w", err),
		}
		m.plugins[path] = loaded
		return loaded, loaded.Error
	}

	newPluginSym, err := p.Lookup("NewPlugin")
	if err != nil {
		loaded := &LoadedPlugin{
			Path:  path,
			State: PluginStateError,
			Error: fmt.Errorf("plugin missing NewPlugin symbol: %w", err),
		}
		m.plugins[path] = loaded
		return loaded, loaded.Error
	}

	newPluginFunc, ok := newPluginSym.(func() Plugin)
	if !ok {
		loaded := &LoadedPlugin{
			Path:  path,
			State: PluginStateError,
			Error: fmt.Errorf("NewPlugin has wrong signature, expected func() Plugin"),
		}
		m.plugins[path] = loaded
		return loaded, loaded.Error
	}

	pluginInstance := newPluginFunc()
	info := pluginInstance.Info()

	loaded := &LoadedPlugin{
		Info:   info,
		State:  PluginStateLoaded,
		Path:   path,
		Plugin: pluginInstance,
	}

	m.plugins[path] = loaded
	return loaded, nil
}

func (m *Manager) Init(ctx context.Context, path string, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	loaded, ok := m.plugins[path]
	if !ok {
		return fmt.Errorf("plugin not loaded: %s", path)
	}

	if loaded.State != PluginStateLoaded {
		return fmt.Errorf("plugin in wrong state: %s", loaded.State)
	}

	if err := loaded.Plugin.Init(ctx, config); err != nil {
		loaded.State = PluginStateError
		loaded.Error = err
		return err
	}

	return nil
}

func (m *Manager) Start(ctx context.Context, path string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	loaded, ok := m.plugins[path]
	if !ok {
		return fmt.Errorf("plugin not loaded: %s", path)
	}

	if err := loaded.Plugin.Start(ctx); err != nil {
		loaded.State = PluginStateError
		loaded.Error = err
		return err
	}

	loaded.State = PluginStateActive
	return nil
}

func (m *Manager) Stop(ctx context.Context, path string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	loaded, ok := m.plugins[path]
	if !ok {
		return fmt.Errorf("plugin not loaded: %s", path)
	}

	if loaded.State != PluginStateActive {
		return nil
	}

	if err := loaded.Plugin.Stop(ctx); err != nil {
		loaded.State = PluginStateError
		loaded.Error = err
		return err
	}

	loaded.State = PluginStateLoaded
	return nil
}

func (m *Manager) Unload(path string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	loaded, ok := m.plugins[path]
	if !ok {
		return nil
	}

	if loaded.Plugin != nil {
		_ = loaded.Plugin.Cleanup()
	}

	delete(m.plugins, path)
	return nil
}

func (m *Manager) List() []*LoadedPlugin {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]*LoadedPlugin, 0, len(m.plugins))
	for _, p := range m.plugins {
		result = append(result, p)
	}
	return result
}

func (m *Manager) Get(path string) *LoadedPlugin {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.plugins[path]
}

func (m *Manager) GetByName(name string) *LoadedPlugin {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, p := range m.plugins {
		if p.Info.Name == name {
			return p
		}
	}
	return nil
}

func (m *Manager) LoadAll(ctx context.Context) error {
	paths, err := m.Discover()
	if err != nil {
		return err
	}

	for _, path := range paths {
		if _, err := m.Load(path); err != nil {
			continue
		}
		if err := m.Init(ctx, path, nil); err != nil {
			continue
		}
		_ = m.Start(ctx, path)
	}

	return nil
}

func (m *Manager) StopAll(ctx context.Context) {
	m.mu.RLock()
	paths := make([]string, 0, len(m.plugins))
	for path := range m.plugins {
		paths = append(paths, path)
	}
	m.mu.RUnlock()

	for _, path := range paths {
		_ = m.Stop(ctx, path)
	}
}

func (m *Manager) UnloadAll() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, loaded := range m.plugins {
		if loaded.Plugin != nil {
			_ = loaded.Plugin.Cleanup()
		}
	}
	m.plugins = make(map[string]*LoadedPlugin)
}

func (m *Manager) GetAgentPlugins() []AgentPlugin {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var agents []AgentPlugin
	for _, loaded := range m.plugins {
		if loaded.State == PluginStateActive {
			if agent, ok := loaded.Plugin.(AgentPlugin); ok {
				agents = append(agents, agent)
			}
		}
	}
	return agents
}

func (m *Manager) GetToolPlugins() []ToolPlugin {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var tools []ToolPlugin
	for _, loaded := range m.plugins {
		if loaded.State == PluginStateActive {
			if tool, ok := loaded.Plugin.(ToolPlugin); ok {
				tools = append(tools, tool)
			}
		}
	}
	return tools
}

func (m *Manager) GetThemePlugins() []ThemePlugin {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var themes []ThemePlugin
	for _, loaded := range m.plugins {
		if loaded.State == PluginStateActive {
			if theme, ok := loaded.Plugin.(ThemePlugin); ok {
				themes = append(themes, theme)
			}
		}
	}
	return themes
}
