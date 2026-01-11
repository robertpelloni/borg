package orchestrator

import (
	"encoding/json"
	"fmt"
	"strings"
	"text/template"

	"github.com/aios/superai-cli/internal/provider"
)

type PrompterConfig struct {
	SystemPromptTemplate string
	ToolCallFormat       string
	MaxToolDescLength    int
	IncludeExamples      bool
	IncludeThinkingTags  bool
	Persona              string
}

func DefaultPrompterConfig() PrompterConfig {
	return PrompterConfig{
		SystemPromptTemplate: defaultSystemPrompt,
		ToolCallFormat:       "native",
		MaxToolDescLength:    500,
		IncludeExamples:      true,
		IncludeThinkingTags:  true,
		Persona:              "assistant",
	}
}

type Prompter struct {
	config    PrompterConfig
	templates map[string]*template.Template
}

func NewPrompter(config PrompterConfig) *Prompter {
	p := &Prompter{
		config:    config,
		templates: make(map[string]*template.Template),
	}
	p.initTemplates()
	return p
}

func (p *Prompter) initTemplates() {
	p.templates["system"] = template.Must(template.New("system").Parse(p.config.SystemPromptTemplate))
	p.templates["tool_list"] = template.Must(template.New("tool_list").Parse(toolListTemplate))
	p.templates["tool_result"] = template.Must(template.New("tool_result").Parse(toolResultTemplate))
}

func (p *Prompter) BuildSystemPrompt(tools []provider.ToolDefinition) string {
	var sb strings.Builder

	sb.WriteString(p.getPersonaPrompt())
	sb.WriteString("\n\n")

	if len(tools) > 0 {
		sb.WriteString("## Available Tools\n\n")
		sb.WriteString(p.formatToolList(tools))
		sb.WriteString("\n\n")
		sb.WriteString(p.getToolUsageInstructions())
	}

	if p.config.IncludeThinkingTags {
		sb.WriteString("\n\n")
		sb.WriteString(thinkingInstructions)
	}

	return sb.String()
}

func (p *Prompter) getPersonaPrompt() string {
	switch p.config.Persona {
	case "coder":
		return coderPersona
	case "analyst":
		return analystPersona
	case "creative":
		return creativePersona
	default:
		return defaultPersona
	}
}

func (p *Prompter) formatToolList(tools []provider.ToolDefinition) string {
	var sb strings.Builder

	for _, tool := range tools {
		sb.WriteString(fmt.Sprintf("### %s\n", tool.Name))

		desc := tool.Description
		if len(desc) > p.config.MaxToolDescLength {
			desc = desc[:p.config.MaxToolDescLength] + "..."
		}
		sb.WriteString(desc)
		sb.WriteString("\n\n")

		if len(tool.Parameters) > 0 {
			sb.WriteString("**Parameters:**\n```json\n")
			paramJSON, _ := json.MarshalIndent(tool.Parameters, "", "  ")
			sb.WriteString(string(paramJSON))
			sb.WriteString("\n```\n\n")
		}
	}

	return sb.String()
}

func (p *Prompter) getToolUsageInstructions() string {
	return toolUsageInstructions
}

func (p *Prompter) FormatToolResult(name string, result interface{}, err error) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("Tool: %s\n", name))

	if err != nil {
		sb.WriteString(fmt.Sprintf("Status: Error\nError: %s\n", err.Error()))
		return sb.String()
	}

	sb.WriteString("Status: Success\n")

	switch v := result.(type) {
	case string:
		if len(v) > 10000 {
			sb.WriteString(fmt.Sprintf("Result (truncated):\n%s\n... (%d more characters)", v[:10000], len(v)-10000))
		} else {
			sb.WriteString(fmt.Sprintf("Result:\n%s", v))
		}
	case []byte:
		s := string(v)
		if len(s) > 10000 {
			sb.WriteString(fmt.Sprintf("Result (truncated):\n%s\n... (%d more bytes)", s[:10000], len(s)-10000))
		} else {
			sb.WriteString(fmt.Sprintf("Result:\n%s", s))
		}
	default:
		jsonBytes, _ := json.MarshalIndent(v, "", "  ")
		s := string(jsonBytes)
		if len(s) > 10000 {
			sb.WriteString(fmt.Sprintf("Result (truncated):\n%s\n...", s[:10000]))
		} else {
			sb.WriteString(fmt.Sprintf("Result:\n%s", s))
		}
	}

	return sb.String()
}

func (p *Prompter) BuildUserPrompt(input string, context ...string) string {
	var sb strings.Builder

	if len(context) > 0 {
		sb.WriteString("## Context\n\n")
		for _, ctx := range context {
			sb.WriteString(ctx)
			sb.WriteString("\n\n")
		}
		sb.WriteString("## Request\n\n")
	}

	sb.WriteString(input)

	return sb.String()
}

func (p *Prompter) ParseToolCalls(content string) []ParsedToolCall {
	var calls []ParsedToolCall

	xmlCalls := p.parseXMLToolCalls(content)
	calls = append(calls, xmlCalls...)

	jsonCalls := p.parseJSONToolCalls(content)
	calls = append(calls, jsonCalls...)

	return calls
}

type ParsedToolCall struct {
	Name      string
	Arguments map[string]interface{}
	Raw       string
}

func (p *Prompter) parseXMLToolCalls(content string) []ParsedToolCall {
	var calls []ParsedToolCall

	toolStart := "<tool_call>"
	toolEnd := "</tool_call>"

	remaining := content
	for {
		start := strings.Index(remaining, toolStart)
		if start == -1 {
			break
		}

		end := strings.Index(remaining[start:], toolEnd)
		if end == -1 {
			break
		}

		toolContent := remaining[start+len(toolStart) : start+end]
		remaining = remaining[start+end+len(toolEnd):]

		call := p.parseToolContent(toolContent)
		if call.Name != "" {
			calls = append(calls, call)
		}
	}

	return calls
}

func (p *Prompter) parseJSONToolCalls(content string) []ParsedToolCall {
	var calls []ParsedToolCall

	codeBlockStart := "```json"
	codeBlockEnd := "```"

	remaining := content
	for {
		start := strings.Index(remaining, codeBlockStart)
		if start == -1 {
			break
		}

		end := strings.Index(remaining[start+len(codeBlockStart):], codeBlockEnd)
		if end == -1 {
			break
		}

		jsonContent := strings.TrimSpace(remaining[start+len(codeBlockStart) : start+len(codeBlockStart)+end])
		remaining = remaining[start+len(codeBlockStart)+end+len(codeBlockEnd):]

		var toolCall struct {
			Tool      string                 `json:"tool"`
			Name      string                 `json:"name"`
			Arguments map[string]interface{} `json:"arguments"`
			Args      map[string]interface{} `json:"args"`
		}

		if err := json.Unmarshal([]byte(jsonContent), &toolCall); err != nil {
			continue
		}

		name := toolCall.Name
		if name == "" {
			name = toolCall.Tool
		}

		args := toolCall.Arguments
		if args == nil {
			args = toolCall.Args
		}

		if name != "" {
			calls = append(calls, ParsedToolCall{
				Name:      name,
				Arguments: args,
				Raw:       jsonContent,
			})
		}
	}

	return calls
}

func (p *Prompter) parseToolContent(content string) ParsedToolCall {
	content = strings.TrimSpace(content)

	var toolCall struct {
		Name      string                 `json:"name"`
		Tool      string                 `json:"tool"`
		Arguments map[string]interface{} `json:"arguments"`
		Args      map[string]interface{} `json:"args"`
	}

	if err := json.Unmarshal([]byte(content), &toolCall); err == nil {
		name := toolCall.Name
		if name == "" {
			name = toolCall.Tool
		}
		args := toolCall.Arguments
		if args == nil {
			args = toolCall.Args
		}
		return ParsedToolCall{
			Name:      name,
			Arguments: args,
			Raw:       content,
		}
	}

	return ParsedToolCall{}
}

func (p *Prompter) ExtractThinking(content string) (thinking, response string) {
	markers := []struct {
		start, end string
	}{
		{"<thinking>", "</thinking>"},
		{"<thought>", "</thought>"},
		{"[THINKING]", "[/THINKING]"},
	}

	for _, m := range markers {
		if start := strings.Index(content, m.start); start != -1 {
			thinkStart := start + len(m.start)
			if end := strings.Index(content[thinkStart:], m.end); end != -1 {
				thinking = strings.TrimSpace(content[thinkStart : thinkStart+end])
				response = strings.TrimSpace(content[:start] + content[thinkStart+end+len(m.end):])
				return
			}
		}
	}

	return "", content
}

func (p *Prompter) WrapWithThinking(thinking, response string) string {
	if thinking == "" {
		return response
	}
	return fmt.Sprintf("<thinking>\n%s\n</thinking>\n\n%s", thinking, response)
}

const defaultSystemPrompt = `You are a helpful AI assistant with access to tools.`

const defaultPersona = `You are a helpful AI assistant. You are accurate, concise, and helpful.
You have access to tools that allow you to interact with the system and gather information.
Use tools when needed to provide accurate and helpful responses.
Always think through problems step by step before acting.`

const coderPersona = `You are an expert software engineer and coding assistant.
You write clean, efficient, and well-documented code.
You follow best practices and design patterns.
You explain your code clearly and help users understand complex concepts.
You have access to tools for reading, writing, and executing code.`

const analystPersona = `You are a data analyst and research assistant.
You excel at analyzing information, finding patterns, and drawing insights.
You present data clearly and make complex information accessible.
You have access to tools for searching, reading, and analyzing data.`

const creativePersona = `You are a creative writing and brainstorming assistant.
You help generate ideas, write content, and provide creative solutions.
You are imaginative while remaining helpful and on-topic.
You have access to tools to help research and refine creative work.`

const toolUsageInstructions = `## Tool Usage Guidelines

1. **Analyze First**: Before using a tool, explain your reasoning and what you expect to learn.
2. **One Step at a Time**: Execute tools sequentially unless parallel execution is clearly beneficial.
3. **Verify Results**: After using a tool, interpret the results before proceeding.
4. **Handle Errors**: If a tool fails, explain the error and try an alternative approach.
5. **Minimize Calls**: Use the minimum number of tool calls necessary to complete the task.

When you need to use a tool, the system will automatically detect your intent and execute the appropriate tool call.`

const thinkingInstructions = `## Thinking Process

When solving complex problems, use <thinking> tags to show your reasoning:

<thinking>
Your step-by-step reasoning here...
</thinking>

This helps users understand your thought process and allows you to work through problems methodically.`

const toolListTemplate = `{{range .}}### {{.Name}}
{{.Description}}
{{if .Parameters}}
Parameters: {{.Parameters}}
{{end}}
{{end}}`

const toolResultTemplate = `Tool: {{.Name}}
Status: {{if .Error}}Error{{else}}Success{{end}}
{{if .Error}}Error: {{.Error}}{{else}}Result: {{.Result}}{{end}}`
