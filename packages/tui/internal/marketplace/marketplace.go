package marketplace

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"
)

const (
	DefaultRegistryURL = "https://raw.githubusercontent.com/aios/superai-plugins/main/registry.json"
	CacheExpiry        = 1 * time.Hour
)

type PluginInfo struct {
	ID           string            `json:"id"`
	Name         string            `json:"name"`
	Description  string            `json:"description"`
	Version      string            `json:"version"`
	Author       string            `json:"author"`
	License      string            `json:"license"`
	Repository   string            `json:"repository"`
	Homepage     string            `json:"homepage"`
	Tags         []string          `json:"tags"`
	Category     string            `json:"category"`
	Downloads    int               `json:"downloads"`
	Stars        int               `json:"stars"`
	CreatedAt    time.Time         `json:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at"`
	Platforms    []string          `json:"platforms"`
	Dependencies []string          `json:"dependencies"`
	Binary       map[string]string `json:"binary"`
	Checksum     map[string]string `json:"checksum"`
	Verified     bool              `json:"verified"`
	Featured     bool              `json:"featured"`
}

type Registry struct {
	Version     string       `json:"version"`
	UpdatedAt   time.Time    `json:"updated_at"`
	Plugins     []PluginInfo `json:"plugins"`
	Categories  []string     `json:"categories"`
	FeaturedIDs []string     `json:"featured_ids"`
}

type InstalledPlugin struct {
	ID          string    `json:"id"`
	Version     string    `json:"version"`
	InstalledAt time.Time `json:"installed_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	Path        string    `json:"path"`
	Enabled     bool      `json:"enabled"`
}

type MarketplaceConfig struct {
	RegistryURL string            `json:"registry_url"`
	Installed   []InstalledPlugin `json:"installed"`
	LastSync    time.Time         `json:"last_sync"`
}

type Marketplace struct {
	config      *MarketplaceConfig
	registry    *Registry
	configPath  string
	cachePath   string
	pluginsDir  string
	httpClient  *http.Client
	mu          sync.RWMutex
	registryURL string
}

func NewMarketplace() *Marketplace {
	homeDir, _ := os.UserHomeDir()
	superaiDir := filepath.Join(homeDir, ".superai")

	m := &Marketplace{
		configPath:  filepath.Join(superaiDir, "marketplace.json"),
		cachePath:   filepath.Join(superaiDir, "cache", "registry.json"),
		pluginsDir:  filepath.Join(superaiDir, "plugins"),
		registryURL: DefaultRegistryURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}

	m.loadConfig()
	return m
}

func (m *Marketplace) loadConfig() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	data, err := os.ReadFile(m.configPath)
	if err != nil {
		if os.IsNotExist(err) {
			m.config = &MarketplaceConfig{
				RegistryURL: DefaultRegistryURL,
				Installed:   []InstalledPlugin{},
			}
			return nil
		}
		return err
	}

	m.config = &MarketplaceConfig{}
	return json.Unmarshal(data, m.config)
}

func (m *Marketplace) SaveConfig() error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	data, err := json.MarshalIndent(m.config, "", "  ")
	if err != nil {
		return err
	}

	dir := filepath.Dir(m.configPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	return os.WriteFile(m.configPath, data, 0644)
}

func (m *Marketplace) Sync() error {
	resp, err := m.httpClient.Get(m.registryURL)
	if err != nil {
		return m.loadCachedRegistry()
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return m.loadCachedRegistry()
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	registry := &Registry{}
	if err := json.Unmarshal(data, registry); err != nil {
		return err
	}

	m.mu.Lock()
	m.registry = registry
	m.config.LastSync = time.Now()
	m.mu.Unlock()

	cacheDir := filepath.Dir(m.cachePath)
	os.MkdirAll(cacheDir, 0755)
	os.WriteFile(m.cachePath, data, 0644)

	return m.SaveConfig()
}

func (m *Marketplace) loadCachedRegistry() error {
	data, err := os.ReadFile(m.cachePath)
	if err != nil {
		return fmt.Errorf("no cached registry available: %w", err)
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	m.registry = &Registry{}
	return json.Unmarshal(data, m.registry)
}

func (m *Marketplace) NeedsSync() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.registry == nil {
		return true
	}
	return time.Since(m.config.LastSync) > CacheExpiry
}

func (m *Marketplace) Search(query string) []PluginInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.registry == nil {
		return nil
	}

	query = strings.ToLower(query)
	var results []PluginInfo

	for _, p := range m.registry.Plugins {
		if strings.Contains(strings.ToLower(p.Name), query) ||
			strings.Contains(strings.ToLower(p.Description), query) ||
			strings.Contains(strings.ToLower(p.ID), query) {
			results = append(results, p)
			continue
		}
		for _, tag := range p.Tags {
			if strings.Contains(strings.ToLower(tag), query) {
				results = append(results, p)
				break
			}
		}
	}

	sort.Slice(results, func(i, j int) bool {
		if results[i].Featured != results[j].Featured {
			return results[i].Featured
		}
		return results[i].Downloads > results[j].Downloads
	})

	return results
}

func (m *Marketplace) ListByCategory(category string) []PluginInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.registry == nil {
		return nil
	}

	var results []PluginInfo
	for _, p := range m.registry.Plugins {
		if strings.EqualFold(p.Category, category) {
			results = append(results, p)
		}
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].Downloads > results[j].Downloads
	})

	return results
}

func (m *Marketplace) ListFeatured() []PluginInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.registry == nil {
		return nil
	}

	var results []PluginInfo
	for _, p := range m.registry.Plugins {
		if p.Featured {
			results = append(results, p)
		}
	}
	return results
}

func (m *Marketplace) ListAll() []PluginInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.registry == nil {
		return nil
	}
	return m.registry.Plugins
}

func (m *Marketplace) GetPlugin(id string) *PluginInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.registry == nil {
		return nil
	}

	for _, p := range m.registry.Plugins {
		if p.ID == id {
			return &p
		}
	}
	return nil
}

func (m *Marketplace) GetCategories() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.registry == nil {
		return nil
	}
	return m.registry.Categories
}

func (m *Marketplace) Install(pluginID string) error {
	plugin := m.GetPlugin(pluginID)
	if plugin == nil {
		return fmt.Errorf("plugin not found: %s", pluginID)
	}

	platform := getPlatformKey()
	binaryURL, ok := plugin.Binary[platform]
	if !ok {
		return fmt.Errorf("plugin not available for platform: %s", platform)
	}

	pluginDir := filepath.Join(m.pluginsDir, plugin.ID)
	if err := os.MkdirAll(pluginDir, 0755); err != nil {
		return fmt.Errorf("create plugin dir: %w", err)
	}

	binaryPath := filepath.Join(pluginDir, plugin.ID)
	if runtime.GOOS == "windows" {
		binaryPath += ".exe"
	}

	if err := m.downloadFile(binaryURL, binaryPath); err != nil {
		os.RemoveAll(pluginDir)
		return fmt.Errorf("download plugin: %w", err)
	}

	if runtime.GOOS != "windows" {
		os.Chmod(binaryPath, 0755)
	}

	m.mu.Lock()
	installed := InstalledPlugin{
		ID:          plugin.ID,
		Version:     plugin.Version,
		InstalledAt: time.Now(),
		UpdatedAt:   time.Now(),
		Path:        pluginDir,
		Enabled:     true,
	}

	found := false
	for i, p := range m.config.Installed {
		if p.ID == plugin.ID {
			m.config.Installed[i] = installed
			found = true
			break
		}
	}
	if !found {
		m.config.Installed = append(m.config.Installed, installed)
	}
	m.mu.Unlock()

	return m.SaveConfig()
}

func (m *Marketplace) Uninstall(pluginID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	var found *InstalledPlugin
	var index int
	for i, p := range m.config.Installed {
		if p.ID == pluginID {
			found = &m.config.Installed[i]
			index = i
			break
		}
	}

	if found == nil {
		return fmt.Errorf("plugin not installed: %s", pluginID)
	}

	if err := os.RemoveAll(found.Path); err != nil {
		return fmt.Errorf("remove plugin dir: %w", err)
	}

	m.config.Installed = append(m.config.Installed[:index], m.config.Installed[index+1:]...)
	return m.SaveConfig()
}

func (m *Marketplace) Update(pluginID string) error {
	installed := m.GetInstalled(pluginID)
	if installed == nil {
		return fmt.Errorf("plugin not installed: %s", pluginID)
	}

	remote := m.GetPlugin(pluginID)
	if remote == nil {
		return fmt.Errorf("plugin not found in registry: %s", pluginID)
	}

	if installed.Version == remote.Version {
		return nil
	}

	return m.Install(pluginID)
}

func (m *Marketplace) UpdateAll() ([]string, error) {
	var updated []string
	var errs []string

	for _, installed := range m.ListInstalled() {
		remote := m.GetPlugin(installed.ID)
		if remote == nil {
			continue
		}
		if installed.Version != remote.Version {
			if err := m.Install(installed.ID); err != nil {
				errs = append(errs, fmt.Sprintf("%s: %v", installed.ID, err))
			} else {
				updated = append(updated, installed.ID)
			}
		}
	}

	if len(errs) > 0 {
		return updated, fmt.Errorf("some updates failed: %s", strings.Join(errs, "; "))
	}
	return updated, nil
}

func (m *Marketplace) GetInstalled(pluginID string) *InstalledPlugin {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, p := range m.config.Installed {
		if p.ID == pluginID {
			return &p
		}
	}
	return nil
}

func (m *Marketplace) ListInstalled() []InstalledPlugin {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.config.Installed
}

func (m *Marketplace) IsInstalled(pluginID string) bool {
	return m.GetInstalled(pluginID) != nil
}

func (m *Marketplace) HasUpdate(pluginID string) bool {
	installed := m.GetInstalled(pluginID)
	if installed == nil {
		return false
	}
	remote := m.GetPlugin(pluginID)
	if remote == nil {
		return false
	}
	return installed.Version != remote.Version
}

func (m *Marketplace) Enable(pluginID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for i, p := range m.config.Installed {
		if p.ID == pluginID {
			m.config.Installed[i].Enabled = true
			return m.SaveConfig()
		}
	}
	return fmt.Errorf("plugin not installed: %s", pluginID)
}

func (m *Marketplace) Disable(pluginID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for i, p := range m.config.Installed {
		if p.ID == pluginID {
			m.config.Installed[i].Enabled = false
			return m.SaveConfig()
		}
	}
	return fmt.Errorf("plugin not installed: %s", pluginID)
}

func (m *Marketplace) GetPluginPath(pluginID string) string {
	installed := m.GetInstalled(pluginID)
	if installed == nil {
		return ""
	}
	return installed.Path
}

func (m *Marketplace) GetPluginBinary(pluginID string) string {
	installed := m.GetInstalled(pluginID)
	if installed == nil {
		return ""
	}
	binary := filepath.Join(installed.Path, pluginID)
	if runtime.GOOS == "windows" {
		binary += ".exe"
	}
	return binary
}

func (m *Marketplace) RunPlugin(pluginID string, args ...string) (string, error) {
	binary := m.GetPluginBinary(pluginID)
	if binary == "" {
		return "", fmt.Errorf("plugin not installed: %s", pluginID)
	}

	installed := m.GetInstalled(pluginID)
	if !installed.Enabled {
		return "", fmt.Errorf("plugin disabled: %s", pluginID)
	}

	cmd := exec.Command(binary, args...)
	output, err := cmd.CombinedOutput()
	return string(output), err
}

func (m *Marketplace) Stats() MarketplaceStats {
	m.mu.RLock()
	defer m.mu.RUnlock()

	stats := MarketplaceStats{
		InstalledCount: len(m.config.Installed),
		LastSync:       m.config.LastSync,
	}

	if m.registry != nil {
		stats.TotalAvailable = len(m.registry.Plugins)
		stats.Categories = len(m.registry.Categories)
	}

	for _, p := range m.config.Installed {
		if p.Enabled {
			stats.EnabledCount++
		}
		if m.HasUpdate(p.ID) {
			stats.UpdatesAvailable++
		}
	}

	return stats
}

type MarketplaceStats struct {
	TotalAvailable   int
	InstalledCount   int
	EnabledCount     int
	UpdatesAvailable int
	Categories       int
	LastSync         time.Time
}

func (m *Marketplace) downloadFile(url, dest string) error {
	resp, err := m.httpClient.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download failed: %s", resp.Status)
	}

	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, resp.Body)
	return err
}

func getPlatformKey() string {
	os := runtime.GOOS
	arch := runtime.GOARCH

	switch os {
	case "darwin":
		os = "macos"
	}

	switch arch {
	case "amd64":
		arch = "x64"
	case "arm64":
		arch = "arm64"
	}

	return fmt.Sprintf("%s-%s", os, arch)
}

func CreateSampleRegistry() *Registry {
	return &Registry{
		Version:   "1.0.0",
		UpdatedAt: time.Now(),
		Categories: []string{
			"AI Agents",
			"Code Analysis",
			"Documentation",
			"Testing",
			"DevOps",
			"Utilities",
		},
		FeaturedIDs: []string{"code-reviewer", "doc-generator"},
		Plugins: []PluginInfo{
			{
				ID:          "code-reviewer",
				Name:        "Code Reviewer",
				Description: "AI-powered code review assistant",
				Version:     "1.0.0",
				Author:      "SuperAI",
				License:     "MIT",
				Repository:  "https://github.com/aios/superai-plugin-code-reviewer",
				Tags:        []string{"ai", "code-review", "quality"},
				Category:    "Code Analysis",
				Downloads:   1500,
				Stars:       120,
				Verified:    true,
				Featured:    true,
				Platforms:   []string{"linux-x64", "macos-x64", "macos-arm64", "windows-x64"},
				Binary: map[string]string{
					"linux-x64":   "https://example.com/plugins/code-reviewer/linux-x64",
					"macos-x64":   "https://example.com/plugins/code-reviewer/macos-x64",
					"macos-arm64": "https://example.com/plugins/code-reviewer/macos-arm64",
					"windows-x64": "https://example.com/plugins/code-reviewer/windows-x64.exe",
				},
			},
			{
				ID:          "doc-generator",
				Name:        "Doc Generator",
				Description: "Automatic documentation generator from code",
				Version:     "2.1.0",
				Author:      "SuperAI",
				License:     "MIT",
				Repository:  "https://github.com/aios/superai-plugin-doc-generator",
				Tags:        []string{"documentation", "markdown", "api"},
				Category:    "Documentation",
				Downloads:   2300,
				Stars:       180,
				Verified:    true,
				Featured:    true,
				Platforms:   []string{"linux-x64", "macos-x64", "macos-arm64", "windows-x64"},
				Binary: map[string]string{
					"linux-x64":   "https://example.com/plugins/doc-generator/linux-x64",
					"macos-x64":   "https://example.com/plugins/doc-generator/macos-x64",
					"macos-arm64": "https://example.com/plugins/doc-generator/macos-arm64",
					"windows-x64": "https://example.com/plugins/doc-generator/windows-x64.exe",
				},
			},
			{
				ID:          "test-runner",
				Name:        "Test Runner",
				Description: "Intelligent test discovery and execution",
				Version:     "1.2.0",
				Author:      "Community",
				License:     "Apache-2.0",
				Repository:  "https://github.com/community/superai-test-runner",
				Tags:        []string{"testing", "automation", "ci"},
				Category:    "Testing",
				Downloads:   800,
				Stars:       45,
				Verified:    false,
				Featured:    false,
				Platforms:   []string{"linux-x64", "macos-x64", "windows-x64"},
				Binary: map[string]string{
					"linux-x64":   "https://example.com/plugins/test-runner/linux-x64",
					"macos-x64":   "https://example.com/plugins/test-runner/macos-x64",
					"windows-x64": "https://example.com/plugins/test-runner/windows-x64.exe",
				},
			},
		},
	}
}
