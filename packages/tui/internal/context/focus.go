package context

import (
	"context"
	"fmt"
	"sort"
	"sync"
)

type FocusLayer int

const (
	LayerSystem FocusLayer = iota
	LayerProject
	LayerTask
	LayerHistory
	LayerUser
)

func (l FocusLayer) String() string {
	switch l {
	case LayerSystem:
		return "system"
	case LayerProject:
		return "project"
	case LayerTask:
		return "task"
	case LayerHistory:
		return "history"
	case LayerUser:
		return "user"
	default:
		return "unknown"
	}
}

func (l FocusLayer) Priority() int {
	switch l {
	case LayerSystem:
		return 100
	case LayerProject:
		return 80
	case LayerTask:
		return 60
	case LayerHistory:
		return 40
	case LayerUser:
		return 20
	default:
		return 0
	}
}

type FocusItem struct {
	Layer       FocusLayer
	Item        *ContextItem
	Required    bool
	Compactible bool
}

type FocusChainConfig struct {
	TokenBudget      int            `yaml:"token_budget"`
	LayerBudgets     map[string]int `yaml:"layer_budgets"`
	EnableCompaction bool           `yaml:"enable_compaction"`
	MaxItemsPerLayer int            `yaml:"max_items_per_layer"`
	ExpandThreshold  float64        `yaml:"expand_threshold"`
}

func DefaultFocusChainConfig() *FocusChainConfig {
	return &FocusChainConfig{
		TokenBudget: 100000,
		LayerBudgets: map[string]int{
			"system":  10000,
			"project": 30000,
			"task":    40000,
			"history": 15000,
			"user":    5000,
		},
		EnableCompaction: true,
		MaxItemsPerLayer: 50,
		ExpandThreshold:  0.8,
	}
}

type FocusChain struct {
	config     *FocusChainConfig
	layers     map[FocusLayer][]*FocusItem
	tokenCount map[FocusLayer]int
	totalCount int
	registry   *Registry
	memory     *MemoryBank
	mu         sync.RWMutex
}

func NewFocusChain(config *FocusChainConfig, registry *Registry, memory *MemoryBank) *FocusChain {
	if config == nil {
		config = DefaultFocusChainConfig()
	}
	return &FocusChain{
		config:     config,
		layers:     make(map[FocusLayer][]*FocusItem),
		tokenCount: make(map[FocusLayer]int),
		registry:   registry,
		memory:     memory,
	}
}

func (fc *FocusChain) Add(layer FocusLayer, item *ContextItem, required bool) error {
	fc.mu.Lock()
	defer fc.mu.Unlock()

	layerBudget := fc.getLayerBudget(layer)
	if layerBudget > 0 && fc.tokenCount[layer]+item.TokenCount > layerBudget {
		if !required {
			if fc.config.EnableCompaction {
				fc.compactLayer(layer, item.TokenCount)
			}
			if fc.tokenCount[layer]+item.TokenCount > layerBudget {
				return fmt.Errorf("layer %s budget exceeded", layer.String())
			}
		}
	}

	if fc.config.TokenBudget > 0 && fc.totalCount+item.TokenCount > fc.config.TokenBudget {
		if !required {
			return fmt.Errorf("total token budget exceeded")
		}
		fc.evictLowestPriority(item.TokenCount)
	}

	focusItem := &FocusItem{
		Layer:       layer,
		Item:        item,
		Required:    required,
		Compactible: !required,
	}

	fc.layers[layer] = append(fc.layers[layer], focusItem)
	fc.tokenCount[layer] += item.TokenCount
	fc.totalCount += item.TokenCount

	return nil
}

func (fc *FocusChain) getLayerBudget(layer FocusLayer) int {
	if budget, ok := fc.config.LayerBudgets[layer.String()]; ok {
		return budget
	}
	return 0
}

func (fc *FocusChain) compactLayer(layer FocusLayer, needed int) {
	items := fc.layers[layer]
	if len(items) == 0 {
		return
	}

	sort.Slice(items, func(i, j int) bool {
		if items[i].Required != items[j].Required {
			return items[i].Required
		}
		return items[i].Item.Priority > items[j].Item.Priority
	})

	freed := 0
	var kept []*FocusItem
	for _, item := range items {
		if item.Required || freed >= needed {
			kept = append(kept, item)
		} else if item.Compactible {
			freed += item.Item.TokenCount
			fc.totalCount -= item.Item.TokenCount
		} else {
			kept = append(kept, item)
		}
	}

	fc.layers[layer] = kept
	fc.tokenCount[layer] -= freed
}

func (fc *FocusChain) evictLowestPriority(needed int) {
	allItems := fc.getAllItems()

	sort.Slice(allItems, func(i, j int) bool {
		if allItems[i].Required != allItems[j].Required {
			return !allItems[i].Required
		}
		if allItems[i].Layer.Priority() != allItems[j].Layer.Priority() {
			return allItems[i].Layer.Priority() < allItems[j].Layer.Priority()
		}
		return allItems[i].Item.Priority < allItems[j].Item.Priority
	})

	freed := 0
	for _, item := range allItems {
		if freed >= needed {
			break
		}
		if item.Required {
			continue
		}
		fc.removeItem(item)
		freed += item.Item.TokenCount
	}
}

func (fc *FocusChain) getAllItems() []*FocusItem {
	var all []*FocusItem
	for _, items := range fc.layers {
		all = append(all, items...)
	}
	return all
}

func (fc *FocusChain) removeItem(item *FocusItem) {
	items := fc.layers[item.Layer]
	for i, fi := range items {
		if fi.Item.ID == item.Item.ID {
			fc.layers[item.Layer] = append(items[:i], items[i+1:]...)
			fc.tokenCount[item.Layer] -= item.Item.TokenCount
			fc.totalCount -= item.Item.TokenCount
			return
		}
	}
}

func (fc *FocusChain) AddSystem(item *ContextItem) error {
	return fc.Add(LayerSystem, item, true)
}

func (fc *FocusChain) AddProject(item *ContextItem) error {
	return fc.Add(LayerProject, item, false)
}

func (fc *FocusChain) AddTask(item *ContextItem) error {
	return fc.Add(LayerTask, item, false)
}

func (fc *FocusChain) AddHistory(item *ContextItem) error {
	return fc.Add(LayerHistory, item, false)
}

func (fc *FocusChain) AddUser(item *ContextItem) error {
	return fc.Add(LayerUser, item, true)
}

func (fc *FocusChain) Build() string {
	fc.mu.RLock()
	defer fc.mu.RUnlock()

	builder := NewContextBuilder(0)

	layerOrder := []FocusLayer{LayerSystem, LayerProject, LayerTask, LayerHistory, LayerUser}

	for _, layer := range layerOrder {
		items := fc.layers[layer]
		if len(items) == 0 {
			continue
		}

		sort.Slice(items, func(i, j int) bool {
			return items[i].Item.Priority > items[j].Item.Priority
		})

		for _, fi := range items {
			builder.Add(fi.Item)
		}
	}

	return builder.Build()
}

func (fc *FocusChain) BuildWithBudget(budget int) string {
	fc.mu.RLock()
	defer fc.mu.RUnlock()

	builder := NewContextBuilder(budget)

	layerOrder := []FocusLayer{LayerSystem, LayerUser, LayerTask, LayerProject, LayerHistory}

	for _, layer := range layerOrder {
		items := fc.layers[layer]

		sort.Slice(items, func(i, j int) bool {
			if items[i].Required != items[j].Required {
				return items[i].Required
			}
			return items[i].Item.Priority > items[j].Item.Priority
		})

		for _, fi := range items {
			if fi.Required {
				builder.AddWithPriority(fi.Item)
			} else {
				builder.Add(fi.Item)
			}
		}
	}

	return builder.Build()
}

func (fc *FocusChain) Items() []*ContextItem {
	fc.mu.RLock()
	defer fc.mu.RUnlock()

	var items []*ContextItem
	for _, layerItems := range fc.layers {
		for _, fi := range layerItems {
			items = append(items, fi.Item)
		}
	}
	return items
}

func (fc *FocusChain) TokenCount() int {
	fc.mu.RLock()
	defer fc.mu.RUnlock()
	return fc.totalCount
}

func (fc *FocusChain) LayerTokenCount(layer FocusLayer) int {
	fc.mu.RLock()
	defer fc.mu.RUnlock()
	return fc.tokenCount[layer]
}

func (fc *FocusChain) Usage() float64 {
	fc.mu.RLock()
	defer fc.mu.RUnlock()
	if fc.config.TokenBudget == 0 {
		return 0
	}
	return float64(fc.totalCount) / float64(fc.config.TokenBudget)
}

func (fc *FocusChain) ShouldExpand() bool {
	return fc.Usage() < fc.config.ExpandThreshold
}

func (fc *FocusChain) Clear() {
	fc.mu.Lock()
	defer fc.mu.Unlock()
	fc.layers = make(map[FocusLayer][]*FocusItem)
	fc.tokenCount = make(map[FocusLayer]int)
	fc.totalCount = 0
}

func (fc *FocusChain) ClearLayer(layer FocusLayer) {
	fc.mu.Lock()
	defer fc.mu.Unlock()
	fc.totalCount -= fc.tokenCount[layer]
	fc.layers[layer] = nil
	fc.tokenCount[layer] = 0
}

func (fc *FocusChain) Stats() map[string]interface{} {
	fc.mu.RLock()
	defer fc.mu.RUnlock()

	layerStats := make(map[string]map[string]int)
	for layer, items := range fc.layers {
		layerStats[layer.String()] = map[string]int{
			"items":  len(items),
			"tokens": fc.tokenCount[layer],
			"budget": fc.getLayerBudget(layer),
		}
	}

	return map[string]interface{}{
		"total_tokens": fc.totalCount,
		"token_budget": fc.config.TokenBudget,
		"usage":        fc.Usage(),
		"layers":       layerStats,
	}
}

type ProgressiveFocus struct {
	chain    *FocusChain
	registry *Registry
	memory   *MemoryBank
}

func NewProgressiveFocus(config *FocusChainConfig, registry *Registry, memory *MemoryBank) *ProgressiveFocus {
	return &ProgressiveFocus{
		chain:    NewFocusChain(config, registry, memory),
		registry: registry,
		memory:   memory,
	}
}

func (pf *ProgressiveFocus) StartNarrow(ctx context.Context, taskContext string) error {
	taskItem := &ContextItem{
		ID:         "task:current",
		Type:       ProviderCustom,
		Name:       "Current Task",
		Content:    taskContext,
		TokenCount: EstimateTokens(taskContext),
		Priority:   100,
	}
	return pf.chain.AddTask(taskItem)
}

func (pf *ProgressiveFocus) ExpandWithProvider(ctx context.Context, providerType ProviderType, args map[string]interface{}) error {
	if pf.registry == nil {
		return fmt.Errorf("no registry available")
	}

	provider, ok := pf.registry.Get(providerType)
	if !ok {
		return fmt.Errorf("provider %s not found", providerType)
	}

	item, err := provider.Fetch(ctx, args)
	if err != nil {
		return err
	}

	layer := pf.determineLayer(providerType)
	return pf.chain.Add(layer, item, false)
}

func (pf *ProgressiveFocus) determineLayer(providerType ProviderType) FocusLayer {
	switch providerType {
	case ProviderFile, ProviderCode, ProviderFolder, ProviderTree:
		return LayerProject
	case ProviderDiff, ProviderSearch:
		return LayerTask
	case ProviderTerminal:
		return LayerHistory
	case ProviderHTTP:
		return LayerUser
	default:
		return LayerTask
	}
}

func (pf *ProgressiveFocus) ExpandWithMemory(ctx context.Context, query string, tokenBudget int) error {
	if pf.memory == nil {
		return fmt.Errorf("no memory bank available")
	}

	items, err := pf.memory.BuildContext(query, tokenBudget)
	if err != nil {
		return err
	}

	for _, item := range items {
		if err := pf.chain.AddProject(item); err != nil {
			break
		}
	}

	return nil
}

func (pf *ProgressiveFocus) ShouldExpand() bool {
	return pf.chain.ShouldExpand()
}

func (pf *ProgressiveFocus) Build() string {
	return pf.chain.Build()
}

func (pf *ProgressiveFocus) BuildWithBudget(budget int) string {
	return pf.chain.BuildWithBudget(budget)
}

func (pf *ProgressiveFocus) Chain() *FocusChain {
	return pf.chain
}

func (pf *ProgressiveFocus) Stats() map[string]interface{} {
	return pf.chain.Stats()
}

type FocusManager struct {
	config   *FocusChainConfig
	registry *Registry
	memory   *MemoryBank
	active   *ProgressiveFocus
	mu       sync.Mutex
}

func NewFocusManager(config *FocusChainConfig, registry *Registry, memory *MemoryBank) *FocusManager {
	return &FocusManager{
		config:   config,
		registry: registry,
		memory:   memory,
	}
}

func (fm *FocusManager) NewSession() *ProgressiveFocus {
	fm.mu.Lock()
	defer fm.mu.Unlock()
	fm.active = NewProgressiveFocus(fm.config, fm.registry, fm.memory)
	return fm.active
}

func (fm *FocusManager) Active() *ProgressiveFocus {
	fm.mu.Lock()
	defer fm.mu.Unlock()
	return fm.active
}

func (fm *FocusManager) Reset() {
	fm.mu.Lock()
	defer fm.mu.Unlock()
	if fm.active != nil {
		fm.active.chain.Clear()
	}
	fm.active = nil
}
