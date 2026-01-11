package tui

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/aios/superai-cli/internal/llm"
	"github.com/aios/superai-cli/internal/orchestrator"
	"github.com/aios/superai-cli/internal/provider"
)

type LLMBridge struct {
	mu sync.RWMutex

	providerRegistry *provider.Registry
	llmClient        *orchestrator.LLMClient
	reactLoop        *orchestrator.ReActLoop
	prompter         *orchestrator.Prompter
	conversation     *orchestrator.Conversation

	legacyProvider llm.Provider
	legacyEngine   *llm.ReActEngine

	useNewSystem   bool
	currentModel   string
	activeProvider string

	onThought     func(string)
	onAction      func(string, map[string]interface{})
	onObservation func(string, string)
	onToken       func(string)
	onUsage       func(provider.Usage)
}

type BridgeConfig struct {
	UseNewSystem  bool
	DefaultModel  string
	MaxIterations int
	MaxTokens     int
	SystemPrompt  string
	Persona       string
}

func NewLLMBridge(cfg BridgeConfig) *LLMBridge {
	b := &LLMBridge{
		useNewSystem: cfg.UseNewSystem,
		currentModel: cfg.DefaultModel,
	}

	if cfg.UseNewSystem {
		b.providerRegistry = provider.NewRegistry()

		prompterCfg := orchestrator.DefaultPrompterConfig()
		if cfg.Persona != "" {
			prompterCfg.Persona = cfg.Persona
		}
		b.prompter = orchestrator.NewPrompter(prompterCfg)

		convCfg := orchestrator.DefaultConversationConfig()
		if cfg.MaxTokens > 0 {
			convCfg.MaxTokens = cfg.MaxTokens
		}
		b.conversation = orchestrator.NewConversation(convCfg)
		if cfg.SystemPrompt != "" {
			b.conversation.SetSystemPrompt(cfg.SystemPrompt)
		}
	}

	return b
}

func (b *LLMBridge) InitNewProvider(name string, config provider.ProviderConfig) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	if !b.useNewSystem {
		return fmt.Errorf("new system not enabled")
	}

	if err := b.providerRegistry.Register(name, config); err != nil {
		return fmt.Errorf("register provider: %w", err)
	}

	prov, ok := b.providerRegistry.Get(name)
	if !ok {
		return fmt.Errorf("get provider: not found")
	}

	if b.llmClient == nil {
		b.llmClient = orchestrator.NewLLMClient(nil, nil)
	}
	b.llmClient.AddProvider(name, prov)

	return nil
}

func (b *LLMBridge) InitLegacyProvider(p llm.Provider) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.legacyProvider = p
	b.legacyEngine = llm.NewReActEngine(llm.ReActConfig{
		Provider: p,
	})
}

func (b *LLMBridge) SetModel(model string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.currentModel = model
	if b.legacyProvider != nil {
		b.legacyProvider.SetModel(model)
	}
}

func (b *LLMBridge) GetModel() string {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.currentModel
}

func (b *LLMBridge) RegisterTool(name, description string, schema map[string]interface{}, handler func(context.Context, json.RawMessage) (interface{}, error)) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.legacyEngine != nil {
		legacyHandler := func(ctx context.Context, args map[string]interface{}) (string, error) {
			argsJSON, err := json.Marshal(args)
			if err != nil {
				return "", fmt.Errorf("marshal args: %w", err)
			}
			result, err := handler(ctx, argsJSON)
			if err != nil {
				return "", err
			}
			switch v := result.(type) {
			case string:
				return v, nil
			default:
				resultJSON, _ := json.Marshal(v)
				return string(resultJSON), nil
			}
		}
		b.legacyEngine.RegisterTool(name, description, schema, legacyHandler)
	}
}

func (b *LLMBridge) SetCallbacks(onThought func(string), onAction func(string, map[string]interface{}), onObservation func(string, string), onToken func(string)) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.onThought = onThought
	b.onAction = onAction
	b.onObservation = onObservation
	b.onToken = onToken

	if b.legacyEngine != nil {
		b.legacyEngine.OnThought = onThought
		b.legacyEngine.OnAction = onAction
		b.legacyEngine.OnObservation = onObservation
		b.legacyEngine.OnToken = onToken
	}
}

func (b *LLMBridge) SetUsageCallback(onUsage func(provider.Usage)) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.onUsage = onUsage
}

func (b *LLMBridge) Chat(ctx context.Context, message string) (string, error) {
	b.mu.RLock()
	useNew := b.useNewSystem && b.llmClient != nil
	b.mu.RUnlock()

	if useNew {
		return b.chatNew(ctx, message)
	}
	return b.chatLegacy(ctx, message)
}

func (b *LLMBridge) chatNew(ctx context.Context, message string) (string, error) {
	b.mu.Lock()
	b.conversation.AddUserMessage(message)
	messages := b.conversation.Messages()
	b.mu.Unlock()

	providerMessages := make([]provider.Message, len(messages))
	for i, m := range messages {
		providerMessages[i] = provider.Message{
			Role:    m.Role,
			Content: m.Content,
		}
	}

	req := orchestrator.ChatRequest{
		Model:    b.currentModel,
		Messages: providerMessages,
	}

	resp, err := b.llmClient.Chat(ctx, req)
	if err != nil {
		return "", err
	}

	content := resp.Message.Content
	b.mu.Lock()
	b.conversation.AddAssistantMessage(content, nil)
	b.mu.Unlock()

	if b.onUsage != nil {
		b.onUsage(resp.Usage)
	}

	return content, nil
}

func (b *LLMBridge) chatLegacy(ctx context.Context, message string) (string, error) {
	if b.legacyEngine == nil {
		return "", fmt.Errorf("no LLM provider configured")
	}
	return b.legacyEngine.Run(ctx, message)
}

func (b *LLMBridge) ChatStream(ctx context.Context, message string) (<-chan string, <-chan error) {
	b.mu.RLock()
	useNew := b.useNewSystem && b.llmClient != nil
	b.mu.RUnlock()

	if useNew {
		return b.chatStreamNew(ctx, message)
	}
	return b.chatStreamLegacy(ctx, message)
}

func (b *LLMBridge) chatStreamNew(ctx context.Context, message string) (<-chan string, <-chan error) {
	tokenCh := make(chan string, 100)
	errCh := make(chan error, 1)

	go func() {
		defer close(tokenCh)
		defer close(errCh)

		b.mu.Lock()
		b.conversation.AddUserMessage(message)
		messages := b.conversation.Messages()
		b.mu.Unlock()

		providerMessages := make([]provider.Message, len(messages))
		for i, m := range messages {
			providerMessages[i] = provider.Message{
				Role:    m.Role,
				Content: m.Content,
			}
		}

		req := orchestrator.ChatRequest{
			Model:    b.currentModel,
			Messages: providerMessages,
			Stream:   true,
		}

		eventCh, err := b.llmClient.ChatStream(ctx, req)
		if err != nil {
			errCh <- err
			return
		}

		var fullContent string

		for event := range eventCh {
			switch event.Type {
			case orchestrator.StreamEventContent:
				tokenCh <- event.Content
				fullContent += event.Content
			case orchestrator.StreamEventError:
				errCh <- event.Error
				return
			case orchestrator.StreamEventUsage:
				if b.onUsage != nil && event.Usage != nil {
					b.onUsage(*event.Usage)
				}
			}
		}

		b.mu.Lock()
		b.conversation.AddAssistantMessage(fullContent, nil)
		b.mu.Unlock()
	}()

	return tokenCh, errCh
}

func (b *LLMBridge) chatStreamLegacy(ctx context.Context, message string) (<-chan string, <-chan error) {
	if b.legacyEngine == nil {
		errCh := make(chan error, 1)
		errCh <- fmt.Errorf("no LLM provider configured")
		close(errCh)
		tokenCh := make(chan string)
		close(tokenCh)
		return tokenCh, errCh
	}
	return b.legacyEngine.RunStream(ctx, message)
}

func (b *LLMBridge) RunReAct(ctx context.Context, message string) (string, error) {
	b.mu.RLock()
	useNew := b.useNewSystem && b.reactLoop != nil
	b.mu.RUnlock()

	if useNew {
		result, err := b.reactLoop.Run(ctx, message)
		if err != nil {
			return "", err
		}
		return result.Answer, nil
	}

	if b.legacyEngine != nil {
		return b.legacyEngine.Run(ctx, message)
	}
	return "", fmt.Errorf("no ReAct engine configured")
}

func (b *LLMBridge) ClearHistory() {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.conversation != nil {
		b.conversation.Clear()
	}
	if b.legacyEngine != nil {
		b.legacyEngine.ClearHistory()
	}
}

func (b *LLMBridge) GetHistory() []llm.Message {
	b.mu.RLock()
	defer b.mu.RUnlock()

	if b.legacyEngine != nil {
		return b.legacyEngine.GetHistory()
	}

	if b.conversation != nil {
		messages := b.conversation.Messages()
		result := make([]llm.Message, len(messages))
		for i, m := range messages {
			result[i] = llm.Message{
				Role:    llm.Role(m.Role),
				Content: m.Content,
			}
		}
		return result
	}

	return nil
}

func (b *LLMBridge) GetConversation() *orchestrator.Conversation {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.conversation
}

func (b *LLMBridge) AddUserMessage(content string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.conversation != nil {
		b.conversation.AddUserMessage(content)
	}
}

func (b *LLMBridge) AddAssistantMessage(content string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.conversation != nil {
		b.conversation.AddAssistantMessage(content, nil)
	}
}

func (b *LLMBridge) GetLLMClient() *orchestrator.LLMClient {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.llmClient
}

func (b *LLMBridge) GetProviderRegistry() *provider.Registry {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.providerRegistry
}

func (b *LLMBridge) IsNewSystemEnabled() bool {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.useNewSystem
}

func (b *LLMBridge) EnableNewSystem(enable bool) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.useNewSystem = enable
}

func (b *LLMBridge) GetLegacyEngine() *llm.ReActEngine {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.legacyEngine
}

func (b *LLMBridge) GetLegacyProvider() llm.Provider {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.legacyProvider
}

func (b *LLMBridge) GetActiveProvider() string {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.activeProvider
}

func (b *LLMBridge) IsReady() bool {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.legacyEngine != nil || (b.useNewSystem && b.llmClient != nil)
}

func (b *LLMBridge) GetProviderName() string {
	b.mu.RLock()
	defer b.mu.RUnlock()
	if b.activeProvider != "" {
		return b.activeProvider
	}
	if b.legacyProvider != nil {
		return b.legacyProvider.Name()
	}
	return "unknown"
}

func (b *LLMBridge) SetActiveProvider(name string) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.providerRegistry == nil {
		if b.legacyProvider != nil && name == b.legacyProvider.Name() {
			b.activeProvider = name
			return nil
		}
		return fmt.Errorf("provider not found: %s", name)
	}

	_, ok := b.providerRegistry.Get(name)
	if !ok {
		return fmt.Errorf("provider not found: %s", name)
	}

	b.activeProvider = name
	return nil
}

func (b *LLMBridge) InitReActLoop(registry *orchestrator.Registry) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	if !b.useNewSystem || b.llmClient == nil {
		return fmt.Errorf("new system not enabled or LLM client not initialized")
	}

	config := orchestrator.ReActConfig{
		MaxIterations:  20,
		MaxToolCalls:   50,
		EnableParallel: true,
		AutoApprove:    true,
	}

	b.reactLoop = orchestrator.NewReActLoop(b.llmClient, registry, config)

	if b.conversation != nil {
		b.reactLoop.SetConversation(b.conversation)
	}

	if b.onThought != nil {
		b.reactLoop.OnThought(b.onThought)
	}
	if b.onAction != nil {
		b.reactLoop.OnAction(func(name string, args json.RawMessage) {
			var argsMap map[string]interface{}
			json.Unmarshal(args, &argsMap)
			b.onAction(name, argsMap)
		})
	}
	if b.onObservation != nil {
		b.reactLoop.OnObservation(func(tool string, result interface{}, err error) {
			var resultStr string
			if err != nil {
				resultStr = err.Error()
			} else {
				switch v := result.(type) {
				case string:
					resultStr = v
				default:
					data, _ := json.Marshal(v)
					resultStr = string(data)
				}
			}
			b.onObservation(tool, resultStr)
		})
	}

	return nil
}

type ProviderInfo struct {
	Name         string
	Type         string
	Models       []string
	Enabled      bool
	Healthy      bool
	Capabilities []string
}

func (b *LLMBridge) ListProviders() []ProviderInfo {
	b.mu.RLock()
	defer b.mu.RUnlock()

	if b.providerRegistry == nil {
		if b.legacyProvider != nil {
			return []ProviderInfo{{
				Name:    b.legacyProvider.Name(),
				Type:    "legacy",
				Models:  []string{b.legacyProvider.Model()},
				Enabled: true,
				Healthy: true,
			}}
		}
		return nil
	}

	providerNames := b.providerRegistry.ListEnabled()
	result := make([]ProviderInfo, 0, len(providerNames))
	for _, name := range providerNames {
		p, ok := b.providerRegistry.Get(name)
		if !ok {
			continue
		}
		info := p.Info()
		result = append(result, ProviderInfo{
			Name:         info.Name,
			Type:         string(info.Type),
			Models:       info.Models,
			Enabled:      true,
			Healthy:      true,
			Capabilities: capabilitiesToStrings(info.Capabilities),
		})
	}
	return result
}

func capabilitiesToStrings(caps []provider.Capability) []string {
	result := make([]string, len(caps))
	for i, c := range caps {
		result[i] = string(c)
	}
	return result
}

func (b *LLMBridge) GetTotalUsage() provider.Usage {
	b.mu.RLock()
	defer b.mu.RUnlock()

	if b.conversation != nil {
		tokens := b.conversation.TotalTokens()
		return provider.Usage{
			TotalTokens: tokens,
		}
	}
	return provider.Usage{}
}

func (b *LLMBridge) SelectProvider(name string) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.providerRegistry == nil {
		return fmt.Errorf("provider registry not initialized")
	}

	_, ok := b.providerRegistry.Get(name)
	if !ok {
		return fmt.Errorf("provider not found: %s", name)
	}

	return nil
}
