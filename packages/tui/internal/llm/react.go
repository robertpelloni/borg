package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
)

// ToolHandler is a function that executes a tool and returns the result
type ToolHandler func(ctx context.Context, args map[string]interface{}) (string, error)

// ReActEngine implements the Thought-Action-Observation loop
type ReActEngine struct {
	provider      Provider
	tools         map[string]ToolDefinition
	toolHandlers  map[string]ToolHandler
	history       []Message
	systemPrompt  string
	maxIterations int
	mu            sync.RWMutex

	// Callbacks for streaming updates
	OnThought     func(thought string)
	OnAction      func(toolName string, args map[string]interface{})
	OnObservation func(toolName string, result string)
	OnToken       func(token string)
	OnUsage       func(usage Usage)
}

// ReActConfig configures the ReAct engine
type ReActConfig struct {
	Provider      Provider
	SystemPrompt  string
	MaxIterations int
}

// NewReActEngine creates a new ReAct orchestration engine
func NewReActEngine(cfg ReActConfig) *ReActEngine {
	maxIter := cfg.MaxIterations
	if maxIter == 0 {
		maxIter = 10
	}

	systemPrompt := cfg.SystemPrompt
	if systemPrompt == "" {
		systemPrompt = defaultSystemPrompt
	}

	return &ReActEngine{
		provider:      cfg.Provider,
		tools:         make(map[string]ToolDefinition),
		toolHandlers:  make(map[string]ToolHandler),
		history:       []Message{},
		systemPrompt:  systemPrompt,
		maxIterations: maxIter,
	}
}

const defaultSystemPrompt = `You are a helpful AI assistant with access to tools. 
When you need to perform actions, use the available tools.
Think step by step about how to accomplish the user's request.
After using tools, synthesize the results into a helpful response.`

// RegisterTool adds a tool to the engine
func (e *ReActEngine) RegisterTool(name, description string, parameters map[string]interface{}, handler ToolHandler) {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.tools[name] = NewToolDefinition(name, description, parameters)
	e.toolHandlers[name] = handler
}

// RegisterToolFromDef adds a tool from an existing definition
func (e *ReActEngine) RegisterToolFromDef(def ToolDefinition, handler ToolHandler) {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.tools[def.Function.Name] = def
	e.toolHandlers[def.Function.Name] = handler
}

// ClearHistory resets the conversation history
func (e *ReActEngine) ClearHistory() {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.history = []Message{}
}

// GetHistory returns a copy of the conversation history
func (e *ReActEngine) GetHistory() []Message {
	e.mu.RLock()
	defer e.mu.RUnlock()

	result := make([]Message, len(e.history))
	copy(result, e.history)
	return result
}

// Run executes the ReAct loop for a user message
func (e *ReActEngine) Run(ctx context.Context, userMessage string) (string, error) {
	e.mu.Lock()
	e.history = append(e.history, NewUserMessage(userMessage))
	e.mu.Unlock()

	totalUsage := Usage{}

	for i := 0; i < e.maxIterations; i++ {
		// Build messages for API call
		messages := e.buildMessages()
		tools := e.getToolDefinitions()

		req := &ChatRequest{
			Messages: messages,
			Tools:    tools,
		}

		// Call LLM
		resp, err := e.provider.Chat(ctx, req)
		if err != nil {
			return "", fmt.Errorf("LLM call failed: %w", err)
		}

		// Accumulate usage
		totalUsage.PromptTokens += resp.Usage.PromptTokens
		totalUsage.CompletionTokens += resp.Usage.CompletionTokens
		totalUsage.TotalTokens += resp.Usage.TotalTokens

		if e.OnUsage != nil {
			e.OnUsage(totalUsage)
		}

		// Add assistant message to history
		e.mu.Lock()
		e.history = append(e.history, resp.Message)
		e.mu.Unlock()

		// Check if we have tool calls
		if len(resp.Message.ToolCalls) == 0 {
			// No tool calls - this is the final response
			if e.OnThought != nil && resp.Message.Content != "" {
				e.OnThought(resp.Message.Content)
			}
			return resp.Message.Content, nil
		}

		// Execute tool calls
		for _, tc := range resp.Message.ToolCalls {
			if e.OnAction != nil {
				args, _ := ParseToolArguments(tc.Function.Arguments)
				e.OnAction(tc.Function.Name, args)
			}

			result, err := e.executeTool(ctx, tc)

			var resultStr string
			if err != nil {
				resultStr = fmt.Sprintf("Error: %v", err)
			} else {
				resultStr = result
			}

			if e.OnObservation != nil {
				e.OnObservation(tc.Function.Name, resultStr)
			}

			// Add tool result to history
			e.mu.Lock()
			e.history = append(e.history, NewToolResultMessage(tc.ID, tc.Function.Name, resultStr))
			e.mu.Unlock()
		}
	}

	return "", fmt.Errorf("max iterations (%d) reached without final answer", e.maxIterations)
}

// RunStream executes the ReAct loop with streaming responses
func (e *ReActEngine) RunStream(ctx context.Context, userMessage string) (<-chan string, <-chan error) {
	tokens := make(chan string, 100)
	errors := make(chan error, 1)

	go func() {
		defer close(tokens)
		defer close(errors)

		e.mu.Lock()
		e.history = append(e.history, NewUserMessage(userMessage))
		e.mu.Unlock()

		for i := 0; i < e.maxIterations; i++ {
			messages := e.buildMessages()
			tools := e.getToolDefinitions()

			req := &ChatRequest{
				Messages: messages,
				Tools:    tools,
				Stream:   true,
			}

			chunks, err := e.provider.ChatStream(ctx, req)
			if err != nil {
				errors <- fmt.Errorf("LLM stream failed: %w", err)
				return
			}

			// Accumulate the full response
			var contentBuilder strings.Builder
			var toolCalls []ToolCall
			toolCallsMap := make(map[int]*ToolCall) // For incremental tool call building

			for chunk := range chunks {
				if chunk.Done {
					if chunk.Usage != nil && e.OnUsage != nil {
						e.OnUsage(*chunk.Usage)
					}
					break
				}

				// Stream content tokens
				if chunk.Delta.Content != "" {
					contentBuilder.WriteString(chunk.Delta.Content)
					select {
					case tokens <- chunk.Delta.Content:
					case <-ctx.Done():
						return
					}
				}

				// Accumulate tool calls (they come incrementally)
				for _, tc := range chunk.Delta.ToolCalls {
					// Tool calls come with index for streaming
					idx := 0 // OpenAI uses index field, simplified here
					if existing, ok := toolCallsMap[idx]; ok {
						existing.Function.Arguments += tc.Function.Arguments
					} else {
						newTC := tc
						toolCallsMap[idx] = &newTC
					}
				}
			}

			// Convert tool calls map to slice
			for _, tc := range toolCallsMap {
				toolCalls = append(toolCalls, *tc)
			}

			// Build assistant message
			assistantMsg := Message{
				Role:      RoleAssistant,
				Content:   contentBuilder.String(),
				ToolCalls: toolCalls,
			}

			e.mu.Lock()
			e.history = append(e.history, assistantMsg)
			e.mu.Unlock()

			// If no tool calls, we're done
			if len(toolCalls) == 0 {
				return
			}

			// Execute tool calls
			for _, tc := range toolCalls {
				if e.OnAction != nil {
					args, _ := ParseToolArguments(tc.Function.Arguments)
					e.OnAction(tc.Function.Name, args)
				}

				result, err := e.executeTool(ctx, tc)

				var resultStr string
				if err != nil {
					resultStr = fmt.Sprintf("Error: %v", err)
				} else {
					resultStr = result
				}

				if e.OnObservation != nil {
					e.OnObservation(tc.Function.Name, resultStr)
				}

				// Signal tool execution in stream
				select {
				case tokens <- fmt.Sprintf("\n[Tool: %s]\n%s\n", tc.Function.Name, resultStr):
				case <-ctx.Done():
					return
				}

				e.mu.Lock()
				e.history = append(e.history, NewToolResultMessage(tc.ID, tc.Function.Name, resultStr))
				e.mu.Unlock()
			}
		}

		errors <- fmt.Errorf("max iterations (%d) reached", e.maxIterations)
	}()

	return tokens, errors
}

func (e *ReActEngine) buildMessages() []Message {
	e.mu.RLock()
	defer e.mu.RUnlock()

	messages := make([]Message, 0, len(e.history)+1)
	messages = append(messages, NewSystemMessage(e.systemPrompt))
	messages = append(messages, e.history...)
	return messages
}

func (e *ReActEngine) getToolDefinitions() []ToolDefinition {
	e.mu.RLock()
	defer e.mu.RUnlock()

	tools := make([]ToolDefinition, 0, len(e.tools))
	for _, t := range e.tools {
		tools = append(tools, t)
	}
	return tools
}

func (e *ReActEngine) executeTool(ctx context.Context, tc ToolCall) (string, error) {
	e.mu.RLock()
	handler, ok := e.toolHandlers[tc.Function.Name]
	e.mu.RUnlock()

	if !ok {
		return "", fmt.Errorf("unknown tool: %s", tc.Function.Name)
	}

	args, err := ParseToolArguments(tc.Function.Arguments)
	if err != nil {
		return "", fmt.Errorf("parse arguments: %w", err)
	}

	return handler(ctx, args)
}

// SetSystemPrompt updates the system prompt
func (e *ReActEngine) SetSystemPrompt(prompt string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.systemPrompt = prompt
}

// ToolCount returns the number of registered tools
func (e *ReActEngine) ToolCount() int {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return len(e.tools)
}

// HistoryToJSON exports history as JSON for persistence
func (e *ReActEngine) HistoryToJSON() ([]byte, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return json.Marshal(e.history)
}

// LoadHistoryFromJSON restores history from JSON
func (e *ReActEngine) LoadHistoryFromJSON(data []byte) error {
	var history []Message
	if err := json.Unmarshal(data, &history); err != nil {
		return err
	}
	e.mu.Lock()
	e.history = history
	e.mu.Unlock()
	return nil
}
