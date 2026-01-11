package plugin

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"plugin"
	"sync"
	"time"
)

type LoaderConfig struct {
	PluginDir       string
	WatchInterval   time.Duration
	EnableHotReload bool
	MaxLoadRetries  int
	LoadTimeout     time.Duration
}

func DefaultLoaderConfig(configDir string) LoaderConfig {
	return LoaderConfig{
		PluginDir:       filepath.Join(configDir, "plugins"),
		WatchInterval:   2 * time.Second,
		EnableHotReload: true,
		MaxLoadRetries:  3,
		LoadTimeout:     30 * time.Second,
	}
}

type PluginManifest struct {
	Name         string            `json:"name"`
	Version      string            `json:"version"`
	Description  string            `json:"description"`
	Author       string            `json:"author"`
	Type         PluginType        `json:"type"`
	Homepage     string            `json:"homepage,omitempty"`
	License      string            `json:"license,omitempty"`
	MinVersion   string            `json:"min_version,omitempty"`
	Dependencies []string          `json:"dependencies,omitempty"`
	Config       map[string]any    `json:"config,omitempty"`
	Permissions  []string          `json:"permissions,omitempty"`
	EntryPoint   string            `json:"entry_point,omitempty"`
	Tags         []string          `json:"tags,omitempty"`
	Metadata     map[string]string `json:"metadata,omitempty"`
}

type LoadedPluginInfo struct {
	Manifest   PluginManifest
	Path       string
	Hash       string
	LoadedAt   time.Time
	State      PluginState
	Plugin     Plugin
	Error      error
	RetryCount int
}

type Loader struct {
	mu       sync.RWMutex
	config   LoaderConfig
	plugins  map[string]*LoadedPluginInfo
	hashes   map[string]string
	watching bool
	stopCh   chan struct{}
	eventCh  chan LoaderEvent
}

type LoaderEventType int

const (
	LoaderEventDiscovered LoaderEventType = iota
	LoaderEventLoaded
	LoaderEventReloaded
	LoaderEventUnloaded
	LoaderEventError
	LoaderEventChanged
)

type LoaderEvent struct {
	Type      LoaderEventType
	Plugin    string
	Path      string
	Error     error
	Timestamp time.Time
}

func NewLoader(config LoaderConfig) *Loader {
	return &Loader{
		config:  config,
		plugins: make(map[string]*LoadedPluginInfo),
		hashes:  make(map[string]string),
		stopCh:  make(chan struct{}),
		eventCh: make(chan LoaderEvent, 100),
	}
}

func (l *Loader) Events() <-chan LoaderEvent {
	return l.eventCh
}

func (l *Loader) emit(eventType LoaderEventType, pluginName, path string, err error) {
	select {
	case l.eventCh <- LoaderEvent{
		Type:      eventType,
		Plugin:    pluginName,
		Path:      path,
		Error:     err,
		Timestamp: time.Now(),
	}:
	default:
	}
}

func (l *Loader) EnsureDir() error {
	return os.MkdirAll(l.config.PluginDir, 0755)
}

func (l *Loader) Discover() ([]string, error) {
	if err := l.EnsureDir(); err != nil {
		return nil, fmt.Errorf("failed to create plugin directory: %w", err)
	}

	entries, err := os.ReadDir(l.config.PluginDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read plugin directory: %w", err)
	}

	var paths []string
	for _, entry := range entries {
		if entry.IsDir() {
			manifestPath := filepath.Join(l.config.PluginDir, entry.Name(), "manifest.json")
			if _, err := os.Stat(manifestPath); err == nil {
				paths = append(paths, filepath.Join(l.config.PluginDir, entry.Name()))
			}
			continue
		}
		ext := filepath.Ext(entry.Name())
		if ext == ".so" || ext == ".dll" || ext == ".dylib" {
			paths = append(paths, filepath.Join(l.config.PluginDir, entry.Name()))
			l.emit(LoaderEventDiscovered, entry.Name(), filepath.Join(l.config.PluginDir, entry.Name()), nil)
		}
	}

	return paths, nil
}

func (l *Loader) LoadManifest(pluginPath string) (*PluginManifest, error) {
	var manifestPath string
	info, err := os.Stat(pluginPath)
	if err != nil {
		return nil, fmt.Errorf("plugin path not found: %w", err)
	}

	if info.IsDir() {
		manifestPath = filepath.Join(pluginPath, "manifest.json")
	} else {
		dir := filepath.Dir(pluginPath)
		manifestPath = filepath.Join(dir, "manifest.json")
	}

	data, err := os.ReadFile(manifestPath)
	if err != nil {
		return nil, fmt.Errorf("manifest not found: %w", err)
	}

	var manifest PluginManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, fmt.Errorf("invalid manifest: %w", err)
	}

	return &manifest, nil
}

func (l *Loader) computeHash(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}

	return hex.EncodeToString(h.Sum(nil)), nil
}

func (l *Loader) findPluginBinary(pluginPath string) (string, error) {
	info, err := os.Stat(pluginPath)
	if err != nil {
		return "", err
	}

	if !info.IsDir() {
		return pluginPath, nil
	}

	manifest, err := l.LoadManifest(pluginPath)
	if err == nil && manifest.EntryPoint != "" {
		entryPath := filepath.Join(pluginPath, manifest.EntryPoint)
		if _, err := os.Stat(entryPath); err == nil {
			return entryPath, nil
		}
	}

	extensions := []string{".so", ".dll", ".dylib"}
	for _, ext := range extensions {
		pattern := filepath.Join(pluginPath, "*"+ext)
		matches, _ := filepath.Glob(pattern)
		if len(matches) > 0 {
			return matches[0], nil
		}
	}

	return "", fmt.Errorf("no plugin binary found in %s", pluginPath)
}

func (l *Loader) Load(ctx context.Context, pluginPath string) (*LoadedPluginInfo, error) {
	l.mu.Lock()
	defer l.mu.Unlock()

	binaryPath, err := l.findPluginBinary(pluginPath)
	if err != nil {
		return nil, err
	}

	hash, err := l.computeHash(binaryPath)
	if err != nil {
		return nil, fmt.Errorf("failed to compute hash: %w", err)
	}

	if existing, ok := l.plugins[pluginPath]; ok {
		if l.hashes[pluginPath] == hash {
			return existing, nil
		}
	}

	loadCtx, cancel := context.WithTimeout(ctx, l.config.LoadTimeout)
	defer cancel()

	resultCh := make(chan struct {
		plugin Plugin
		err    error
	}, 1)

	go func() {
		p, err := plugin.Open(binaryPath)
		if err != nil {
			resultCh <- struct {
				plugin Plugin
				err    error
			}{nil, fmt.Errorf("failed to open plugin: %w", err)}
			return
		}

		newPluginSym, err := p.Lookup("NewPlugin")
		if err != nil {
			resultCh <- struct {
				plugin Plugin
				err    error
			}{nil, fmt.Errorf("plugin missing NewPlugin symbol: %w", err)}
			return
		}

		newPluginFunc, ok := newPluginSym.(func() Plugin)
		if !ok {
			resultCh <- struct {
				plugin Plugin
				err    error
			}{nil, fmt.Errorf("NewPlugin has wrong signature")}
			return
		}

		resultCh <- struct {
			plugin Plugin
			err    error
		}{newPluginFunc(), nil}
	}()

	select {
	case <-loadCtx.Done():
		return nil, fmt.Errorf("plugin load timeout")
	case result := <-resultCh:
		if result.err != nil {
			loaded := &LoadedPluginInfo{
				Path:     pluginPath,
				Hash:     hash,
				LoadedAt: time.Now(),
				State:    PluginStateError,
				Error:    result.err,
			}
			l.plugins[pluginPath] = loaded
			l.hashes[pluginPath] = hash
			l.emit(LoaderEventError, "", pluginPath, result.err)
			return loaded, result.err
		}

		manifest, _ := l.LoadManifest(pluginPath)
		if manifest == nil {
			info := result.plugin.Info()
			manifest = &PluginManifest{
				Name:        info.Name,
				Version:     info.Version,
				Description: info.Description,
				Author:      info.Author,
				Type:        info.Type,
				Homepage:    info.Homepage,
			}
		}

		loaded := &LoadedPluginInfo{
			Manifest: *manifest,
			Path:     pluginPath,
			Hash:     hash,
			LoadedAt: time.Now(),
			State:    PluginStateLoaded,
			Plugin:   result.plugin,
		}

		l.plugins[pluginPath] = loaded
		l.hashes[pluginPath] = hash
		l.emit(LoaderEventLoaded, manifest.Name, pluginPath, nil)
		return loaded, nil
	}
}

func (l *Loader) Reload(ctx context.Context, pluginPath string) (*LoadedPluginInfo, error) {
	l.mu.Lock()
	existing, ok := l.plugins[pluginPath]
	l.mu.Unlock()

	if ok && existing.Plugin != nil {
		if existing.State == PluginStateActive {
			_ = existing.Plugin.Stop(ctx)
		}
		_ = existing.Plugin.Cleanup()
	}

	l.mu.Lock()
	delete(l.plugins, pluginPath)
	delete(l.hashes, pluginPath)
	l.mu.Unlock()

	loaded, err := l.Load(ctx, pluginPath)
	if err != nil {
		return nil, err
	}

	l.emit(LoaderEventReloaded, loaded.Manifest.Name, pluginPath, nil)
	return loaded, nil
}

func (l *Loader) Unload(ctx context.Context, pluginPath string) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	loaded, ok := l.plugins[pluginPath]
	if !ok {
		return nil
	}

	if loaded.Plugin != nil {
		if loaded.State == PluginStateActive {
			_ = loaded.Plugin.Stop(ctx)
		}
		_ = loaded.Plugin.Cleanup()
	}

	l.emit(LoaderEventUnloaded, loaded.Manifest.Name, pluginPath, nil)
	delete(l.plugins, pluginPath)
	delete(l.hashes, pluginPath)
	return nil
}

func (l *Loader) StartWatching(ctx context.Context) {
	l.mu.Lock()
	if l.watching {
		l.mu.Unlock()
		return
	}
	l.watching = true
	l.mu.Unlock()

	go func() {
		ticker := time.NewTicker(l.config.WatchInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-l.stopCh:
				return
			case <-ticker.C:
				l.checkForChanges(ctx)
			}
		}
	}()
}

func (l *Loader) StopWatching() {
	l.mu.Lock()
	defer l.mu.Unlock()

	if !l.watching {
		return
	}

	close(l.stopCh)
	l.watching = false
	l.stopCh = make(chan struct{})
}

func (l *Loader) checkForChanges(ctx context.Context) {
	if !l.config.EnableHotReload {
		return
	}

	l.mu.RLock()
	pluginPaths := make([]string, 0, len(l.plugins))
	for path := range l.plugins {
		pluginPaths = append(pluginPaths, path)
	}
	l.mu.RUnlock()

	for _, path := range pluginPaths {
		binaryPath, err := l.findPluginBinary(path)
		if err != nil {
			continue
		}

		newHash, err := l.computeHash(binaryPath)
		if err != nil {
			continue
		}

		l.mu.RLock()
		oldHash := l.hashes[path]
		l.mu.RUnlock()

		if newHash != oldHash {
			l.emit(LoaderEventChanged, "", path, nil)
			if _, err := l.Reload(ctx, path); err != nil {
				l.emit(LoaderEventError, "", path, err)
			}
		}
	}

	paths, err := l.Discover()
	if err != nil {
		return
	}

	l.mu.RLock()
	existingPaths := make(map[string]bool)
	for path := range l.plugins {
		existingPaths[path] = true
	}
	l.mu.RUnlock()

	for _, path := range paths {
		if !existingPaths[path] {
			if _, err := l.Load(ctx, path); err != nil {
				l.emit(LoaderEventError, "", path, err)
			}
		}
	}
}

func (l *Loader) LoadAll(ctx context.Context) error {
	paths, err := l.Discover()
	if err != nil {
		return err
	}

	var loadErrors []error
	for _, path := range paths {
		if _, err := l.Load(ctx, path); err != nil {
			loadErrors = append(loadErrors, fmt.Errorf("%s: %w", path, err))
		}
	}

	if len(loadErrors) > 0 {
		return fmt.Errorf("failed to load %d plugins", len(loadErrors))
	}

	return nil
}

func (l *Loader) Get(pluginPath string) *LoadedPluginInfo {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.plugins[pluginPath]
}

func (l *Loader) GetByName(name string) *LoadedPluginInfo {
	l.mu.RLock()
	defer l.mu.RUnlock()

	for _, p := range l.plugins {
		if p.Manifest.Name == name {
			return p
		}
	}
	return nil
}

func (l *Loader) List() []*LoadedPluginInfo {
	l.mu.RLock()
	defer l.mu.RUnlock()

	result := make([]*LoadedPluginInfo, 0, len(l.plugins))
	for _, p := range l.plugins {
		result = append(result, p)
	}
	return result
}

func (l *Loader) ListByType(pluginType PluginType) []*LoadedPluginInfo {
	l.mu.RLock()
	defer l.mu.RUnlock()

	var result []*LoadedPluginInfo
	for _, p := range l.plugins {
		if p.Manifest.Type == pluginType {
			result = append(result, p)
		}
	}
	return result
}

func (l *Loader) ListByState(state PluginState) []*LoadedPluginInfo {
	l.mu.RLock()
	defer l.mu.RUnlock()

	var result []*LoadedPluginInfo
	for _, p := range l.plugins {
		if p.State == state {
			result = append(result, p)
		}
	}
	return result
}

func (l *Loader) Count() int {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return len(l.plugins)
}

func (l *Loader) Config() LoaderConfig {
	return l.config
}
