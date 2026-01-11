package plugin

import (
	"context"
	"fmt"
	"sort"
	"sync"
)

type DependencyNode struct {
	Name         string
	Version      string
	Dependencies []string
	Optional     []string
	Provides     []string
	Conflicts    []string
	LoadOrder    int
	Loaded       bool
}

type Registry struct {
	mu           sync.RWMutex
	plugins      map[string]*LoadedPluginInfo
	nodes        map[string]*DependencyNode
	loadOrder    []string
	capabilities map[string][]string
	conflicts    map[string][]string
}

func NewRegistry() *Registry {
	return &Registry{
		plugins:      make(map[string]*LoadedPluginInfo),
		nodes:        make(map[string]*DependencyNode),
		loadOrder:    make([]string, 0),
		capabilities: make(map[string][]string),
		conflicts:    make(map[string][]string),
	}
}

func (r *Registry) Register(info *LoadedPluginInfo) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	name := info.Manifest.Name
	if _, exists := r.plugins[name]; exists {
		return fmt.Errorf("plugin already registered: %s", name)
	}

	node := &DependencyNode{
		Name:         name,
		Version:      info.Manifest.Version,
		Dependencies: info.Manifest.Dependencies,
		Loaded:       false,
	}

	for _, conflict := range info.Manifest.Metadata {
		if conflict != "" {
			node.Conflicts = append(node.Conflicts, conflict)
		}
	}

	for _, conflict := range node.Conflicts {
		if _, exists := r.plugins[conflict]; exists {
			return fmt.Errorf("plugin %s conflicts with already registered plugin %s", name, conflict)
		}
	}

	r.plugins[name] = info
	r.nodes[name] = node

	for _, cap := range node.Provides {
		r.capabilities[cap] = append(r.capabilities[cap], name)
	}

	for _, conflict := range node.Conflicts {
		r.conflicts[conflict] = append(r.conflicts[conflict], name)
	}

	return nil
}

func (r *Registry) Unregister(name string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	node, exists := r.nodes[name]
	if !exists {
		return nil
	}

	for _, cap := range node.Provides {
		providers := r.capabilities[cap]
		filtered := make([]string, 0, len(providers))
		for _, p := range providers {
			if p != name {
				filtered = append(filtered, p)
			}
		}
		if len(filtered) == 0 {
			delete(r.capabilities, cap)
		} else {
			r.capabilities[cap] = filtered
		}
	}

	for _, conflict := range node.Conflicts {
		conflicting := r.conflicts[conflict]
		filtered := make([]string, 0, len(conflicting))
		for _, c := range conflicting {
			if c != name {
				filtered = append(filtered, c)
			}
		}
		if len(filtered) == 0 {
			delete(r.conflicts, conflict)
		} else {
			r.conflicts[conflict] = filtered
		}
	}

	newOrder := make([]string, 0, len(r.loadOrder))
	for _, n := range r.loadOrder {
		if n != name {
			newOrder = append(newOrder, n)
		}
	}
	r.loadOrder = newOrder

	delete(r.plugins, name)
	delete(r.nodes, name)

	return nil
}

func (r *Registry) Get(name string) *LoadedPluginInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.plugins[name]
}

func (r *Registry) List() []*LoadedPluginInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()

	result := make([]*LoadedPluginInfo, 0, len(r.plugins))
	for _, p := range r.plugins {
		result = append(result, p)
	}
	return result
}

func (r *Registry) ListByType(pluginType PluginType) []*LoadedPluginInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var result []*LoadedPluginInfo
	for _, p := range r.plugins {
		if p.Manifest.Type == pluginType {
			result = append(result, p)
		}
	}
	return result
}

func (r *Registry) ResolveDependencies(name string) ([]string, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	visited := make(map[string]bool)
	visiting := make(map[string]bool)
	order := make([]string, 0)

	var visit func(n string) error
	visit = func(n string) error {
		if visited[n] {
			return nil
		}
		if visiting[n] {
			return fmt.Errorf("circular dependency detected: %s", n)
		}

		node, exists := r.nodes[n]
		if !exists {
			return fmt.Errorf("unknown plugin: %s", n)
		}

		visiting[n] = true

		for _, dep := range node.Dependencies {
			if _, exists := r.nodes[dep]; !exists {
				providers := r.capabilities[dep]
				if len(providers) == 0 {
					return fmt.Errorf("unsatisfied dependency: %s requires %s", n, dep)
				}
				dep = providers[0]
			}
			if err := visit(dep); err != nil {
				return err
			}
		}

		visiting[n] = false
		visited[n] = true
		order = append(order, n)

		return nil
	}

	if err := visit(name); err != nil {
		return nil, err
	}

	return order, nil
}

func (r *Registry) ResolveAll() ([]string, error) {
	r.mu.RLock()
	names := make([]string, 0, len(r.nodes))
	for name := range r.nodes {
		names = append(names, name)
	}
	r.mu.RUnlock()

	visited := make(map[string]bool)
	visiting := make(map[string]bool)
	order := make([]string, 0)

	var visit func(n string) error
	visit = func(n string) error {
		if visited[n] {
			return nil
		}
		if visiting[n] {
			return fmt.Errorf("circular dependency detected: %s", n)
		}

		r.mu.RLock()
		node, exists := r.nodes[n]
		r.mu.RUnlock()

		if !exists {
			return nil
		}

		visiting[n] = true

		for _, dep := range node.Dependencies {
			r.mu.RLock()
			_, depExists := r.nodes[dep]
			providers := r.capabilities[dep]
			r.mu.RUnlock()

			if !depExists {
				if len(providers) == 0 {
					return fmt.Errorf("unsatisfied dependency: %s requires %s", n, dep)
				}
				dep = providers[0]
			}
			if err := visit(dep); err != nil {
				return err
			}
		}

		visiting[n] = false
		visited[n] = true
		order = append(order, n)

		return nil
	}

	for _, name := range names {
		if err := visit(name); err != nil {
			return nil, err
		}
	}

	r.mu.Lock()
	r.loadOrder = order
	for i, name := range order {
		if node, exists := r.nodes[name]; exists {
			node.LoadOrder = i
		}
	}
	r.mu.Unlock()

	return order, nil
}

func (r *Registry) GetLoadOrder() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	result := make([]string, len(r.loadOrder))
	copy(result, r.loadOrder)
	return result
}

func (r *Registry) CheckDependencies(name string) []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	node, exists := r.nodes[name]
	if !exists {
		return nil
	}

	var missing []string
	for _, dep := range node.Dependencies {
		if _, exists := r.nodes[dep]; !exists {
			providers := r.capabilities[dep]
			if len(providers) == 0 {
				missing = append(missing, dep)
			}
		}
	}

	return missing
}

func (r *Registry) GetDependents(name string) []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var dependents []string
	for n, node := range r.nodes {
		for _, dep := range node.Dependencies {
			if dep == name {
				dependents = append(dependents, n)
				break
			}
		}
	}

	return dependents
}

func (r *Registry) HasConflict(name string) (bool, string) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	node, exists := r.nodes[name]
	if !exists {
		return false, ""
	}

	for _, conflict := range node.Conflicts {
		if _, exists := r.plugins[conflict]; exists {
			return true, conflict
		}
	}

	return false, ""
}

func (r *Registry) GetCapabilityProviders(capability string) []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	providers := r.capabilities[capability]
	result := make([]string, len(providers))
	copy(result, providers)
	return result
}

func (r *Registry) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.plugins)
}

func (r *Registry) Names() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	names := make([]string, 0, len(r.plugins))
	for name := range r.plugins {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

func (r *Registry) Clear() {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.plugins = make(map[string]*LoadedPluginInfo)
	r.nodes = make(map[string]*DependencyNode)
	r.loadOrder = make([]string, 0)
	r.capabilities = make(map[string][]string)
	r.conflicts = make(map[string][]string)
}

func (r *Registry) Stats() map[string]any {
	r.mu.RLock()
	defer r.mu.RUnlock()

	typeCounts := make(map[PluginType]int)
	for _, p := range r.plugins {
		typeCounts[p.Manifest.Type]++
	}

	return map[string]any{
		"total_plugins":  len(r.plugins),
		"type_counts":    typeCounts,
		"capabilities":   len(r.capabilities),
		"conflict_rules": len(r.conflicts),
		"resolved_order": len(r.loadOrder),
	}
}

type DependencyResolver struct {
	registry *Registry
}

func NewDependencyResolver(registry *Registry) *DependencyResolver {
	return &DependencyResolver{registry: registry}
}

func (d *DependencyResolver) Resolve(names []string) ([]string, error) {
	if len(names) == 0 {
		return d.registry.ResolveAll()
	}

	visited := make(map[string]bool)
	visiting := make(map[string]bool)
	order := make([]string, 0)

	var visit func(n string) error
	visit = func(n string) error {
		if visited[n] {
			return nil
		}
		if visiting[n] {
			return fmt.Errorf("circular dependency: %s", n)
		}

		d.registry.mu.RLock()
		node, exists := d.registry.nodes[n]
		d.registry.mu.RUnlock()

		if !exists {
			return fmt.Errorf("unknown plugin: %s", n)
		}

		visiting[n] = true

		for _, dep := range node.Dependencies {
			d.registry.mu.RLock()
			_, depExists := d.registry.nodes[dep]
			providers := d.registry.capabilities[dep]
			d.registry.mu.RUnlock()

			if !depExists {
				if len(providers) == 0 {
					return fmt.Errorf("unsatisfied dependency: %s requires %s", n, dep)
				}
				dep = providers[0]
			}
			if err := visit(dep); err != nil {
				return err
			}
		}

		visiting[n] = false
		visited[n] = true
		order = append(order, n)

		return nil
	}

	for _, name := range names {
		if err := visit(name); err != nil {
			return nil, err
		}
	}

	return order, nil
}

func (d *DependencyResolver) ValidateAll(ctx context.Context) []error {
	var errors []error

	d.registry.mu.RLock()
	defer d.registry.mu.RUnlock()

	for name, node := range d.registry.nodes {
		for _, dep := range node.Dependencies {
			if _, exists := d.registry.nodes[dep]; !exists {
				providers := d.registry.capabilities[dep]
				if len(providers) == 0 {
					errors = append(errors, fmt.Errorf("%s: missing dependency %s", name, dep))
				}
			}
		}

		for _, conflict := range node.Conflicts {
			if _, exists := d.registry.plugins[conflict]; exists {
				errors = append(errors, fmt.Errorf("%s: conflicts with %s", name, conflict))
			}
		}
	}

	if _, err := d.Resolve(nil); err != nil {
		errors = append(errors, fmt.Errorf("dependency resolution failed: %w", err))
	}

	return errors
}
