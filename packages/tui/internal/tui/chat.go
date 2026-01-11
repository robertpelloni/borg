package tui

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/bubbles/viewport"
	"github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type ChatMessage struct {
	Role      string
	Content   string
	Timestamp time.Time
	ToolCalls []ToolCallDisplay
	Thinking  string
	Streaming bool
}

type ToolCallDisplay struct {
	Name      string
	Arguments string
	Result    string
	Error     string
	Duration  time.Duration
	Status    string
}

type ChatModel struct {
	viewport     viewport.Model
	input        textarea.Model
	messages     []ChatMessage
	streaming    strings.Builder
	isStreaming  bool
	width        int
	height       int
	inputHeight  int
	focused      bool
	showThinking bool

	userStyle      lipgloss.Style
	assistantStyle lipgloss.Style
	systemStyle    lipgloss.Style
	toolStyle      lipgloss.Style
	thinkingStyle  lipgloss.Style
	timestampStyle lipgloss.Style
	inputStyle     lipgloss.Style
}

type ChatConfig struct {
	Width        int
	Height       int
	InputHeight  int
	ShowThinking bool
}

func DefaultChatConfig() ChatConfig {
	return ChatConfig{
		Width:        80,
		Height:       24,
		InputHeight:  3,
		ShowThinking: true,
	}
}

func NewChatModel(config ChatConfig) ChatModel {
	vp := viewport.New(config.Width, config.Height-config.InputHeight-2)
	vp.SetContent("")

	ta := textarea.New()
	ta.Placeholder = "Type your message... (Enter to send, Shift+Enter for newline)"
	ta.CharLimit = 4096
	ta.SetWidth(config.Width - 2)
	ta.SetHeight(config.InputHeight)
	ta.ShowLineNumbers = false
	ta.Focus()

	success := lipgloss.AdaptiveColor{Light: "#22c55e", Dark: "#22c55e"}
	primary := lipgloss.AdaptiveColor{Light: "#3b82f6", Dark: "#60a5fa"}
	subtle := lipgloss.AdaptiveColor{Light: "#64748b", Dark: "#94a3b8"}
	warning := lipgloss.AdaptiveColor{Light: "#f59e0b", Dark: "#fbbf24"}

	return ChatModel{
		viewport:     vp,
		input:        ta,
		messages:     make([]ChatMessage, 0),
		width:        config.Width,
		height:       config.Height,
		inputHeight:  config.InputHeight,
		showThinking: config.ShowThinking,
		focused:      true,

		userStyle: lipgloss.NewStyle().
			Foreground(success).
			Bold(true),
		assistantStyle: lipgloss.NewStyle().
			Foreground(primary).
			Bold(true),
		systemStyle: lipgloss.NewStyle().
			Foreground(subtle).
			Italic(true),
		toolStyle: lipgloss.NewStyle().
			Foreground(warning),
		thinkingStyle: lipgloss.NewStyle().
			Foreground(subtle).
			Italic(true),
		timestampStyle: lipgloss.NewStyle().
			Foreground(subtle).
			Faint(true),
		inputStyle: lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(primary).
			Padding(0, 1),
	}
}

func (m ChatModel) Init() tea.Cmd {
	return textarea.Blink
}

type ChatSendMsg struct {
	Content string
}

type ChatStreamChunkMsg struct {
	Content string
}

type ChatStreamDoneMsg struct {
	Message ChatMessage
}

type ChatToolCallMsg struct {
	Tool ToolCallDisplay
}

type ChatThinkingMsg struct {
	Thinking string
}

func (m ChatModel) Update(msg tea.Msg) (ChatModel, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		if m.focused {
			switch msg.String() {
			case "enter":
				if msg.Alt {
					m.input, _ = m.input.Update(msg)
				} else {
					content := strings.TrimSpace(m.input.Value())
					if content != "" {
						m.input.Reset()
						return m, func() tea.Msg {
							return ChatSendMsg{Content: content}
						}
					}
				}
			case "ctrl+c":
				return m, tea.Quit
			default:
				var cmd tea.Cmd
				m.input, cmd = m.input.Update(msg)
				cmds = append(cmds, cmd)
			}
		}

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.viewport.Width = msg.Width
		m.viewport.Height = msg.Height - m.inputHeight - 4
		m.input.SetWidth(msg.Width - 4)
		m.renderMessages()

	case ChatStreamChunkMsg:
		m.streaming.WriteString(msg.Content)
		m.isStreaming = true
		m.renderMessages()

	case ChatStreamDoneMsg:
		m.isStreaming = false
		m.streaming.Reset()
		m.messages = append(m.messages, msg.Message)
		m.renderMessages()
		m.viewport.GotoBottom()

	case ChatToolCallMsg:
		if len(m.messages) > 0 {
			last := &m.messages[len(m.messages)-1]
			last.ToolCalls = append(last.ToolCalls, msg.Tool)
			m.renderMessages()
		}

	case ChatThinkingMsg:
		if len(m.messages) > 0 {
			m.messages[len(m.messages)-1].Thinking = msg.Thinking
			m.renderMessages()
		}
	}

	var vpCmd tea.Cmd
	m.viewport, vpCmd = m.viewport.Update(msg)
	cmds = append(cmds, vpCmd)

	return m, tea.Batch(cmds...)
}

func (m *ChatModel) AddUserMessage(content string) {
	m.messages = append(m.messages, ChatMessage{
		Role:      "user",
		Content:   content,
		Timestamp: time.Now(),
	})
	m.renderMessages()
	m.viewport.GotoBottom()
}

func (m *ChatModel) AddAssistantMessage(content string) {
	m.messages = append(m.messages, ChatMessage{
		Role:      "assistant",
		Content:   content,
		Timestamp: time.Now(),
	})
	m.renderMessages()
	m.viewport.GotoBottom()
}

func (m *ChatModel) AddSystemMessage(content string) {
	m.messages = append(m.messages, ChatMessage{
		Role:      "system",
		Content:   content,
		Timestamp: time.Now(),
	})
	m.renderMessages()
	m.viewport.GotoBottom()
}

func (m *ChatModel) StartStreaming() {
	m.isStreaming = true
	m.streaming.Reset()
}

func (m *ChatModel) AppendStream(content string) {
	m.streaming.WriteString(content)
	m.renderMessages()
}

func (m *ChatModel) FinishStreaming(message ChatMessage) {
	m.isStreaming = false
	m.streaming.Reset()
	m.messages = append(m.messages, message)
	m.renderMessages()
	m.viewport.GotoBottom()
}

func (m *ChatModel) Clear() {
	m.messages = make([]ChatMessage, 0)
	m.streaming.Reset()
	m.isStreaming = false
	m.renderMessages()
}

func (m *ChatModel) SetFocus(focused bool) {
	m.focused = focused
	if focused {
		m.input.Focus()
	} else {
		m.input.Blur()
	}
}

func (m *ChatModel) renderMessages() {
	var sb strings.Builder

	for _, msg := range m.messages {
		sb.WriteString(m.renderMessage(msg))
		sb.WriteString("\n\n")
	}

	if m.isStreaming {
		sb.WriteString(m.assistantStyle.Render("Assistant") + " ")
		sb.WriteString(m.timestampStyle.Render("(typing...)"))
		sb.WriteString("\n")
		sb.WriteString(m.streaming.String())
		sb.WriteString("█")
	}

	m.viewport.SetContent(sb.String())
}

func (m *ChatModel) renderMessage(msg ChatMessage) string {
	var sb strings.Builder

	var roleStyle lipgloss.Style
	var roleLabel string

	switch msg.Role {
	case "user":
		roleStyle = m.userStyle
		roleLabel = "You"
	case "assistant":
		roleStyle = m.assistantStyle
		roleLabel = "Assistant"
	case "system":
		roleStyle = m.systemStyle
		roleLabel = "System"
	default:
		roleStyle = m.systemStyle
		roleLabel = msg.Role
	}

	timestamp := m.timestampStyle.Render(msg.Timestamp.Format("15:04:05"))
	sb.WriteString(roleStyle.Render(roleLabel) + " " + timestamp + "\n")

	if msg.Thinking != "" && m.showThinking {
		sb.WriteString(m.thinkingStyle.Render("💭 " + msg.Thinking))
		sb.WriteString("\n\n")
	}

	content := msg.Content
	if m.width > 0 {
		content = wordWrap(content, m.width-4)
	}
	sb.WriteString(content)

	for _, tc := range msg.ToolCalls {
		sb.WriteString("\n")
		sb.WriteString(m.renderToolCall(tc))
	}

	return sb.String()
}

func (m *ChatModel) renderToolCall(tc ToolCallDisplay) string {
	var sb strings.Builder

	statusIcon := "⏳"
	switch tc.Status {
	case "success":
		statusIcon = "✓"
	case "error":
		statusIcon = "✗"
	case "running":
		statusIcon = "⟳"
	}

	sb.WriteString(m.toolStyle.Render(fmt.Sprintf("  %s Tool: %s", statusIcon, tc.Name)))

	if tc.Duration > 0 {
		sb.WriteString(m.timestampStyle.Render(fmt.Sprintf(" (%s)", tc.Duration.Round(time.Millisecond))))
	}
	sb.WriteString("\n")

	if tc.Arguments != "" {
		args := tc.Arguments
		if len(args) > 100 {
			args = args[:100] + "..."
		}
		sb.WriteString(m.thinkingStyle.Render("    Args: " + args))
		sb.WriteString("\n")
	}

	if tc.Error != "" {
		sb.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color("#ef4444")).Render("    Error: " + tc.Error))
		sb.WriteString("\n")
	} else if tc.Result != "" {
		result := tc.Result
		if len(result) > 200 {
			result = result[:200] + "..."
		}
		sb.WriteString(m.thinkingStyle.Render("    Result: " + result))
		sb.WriteString("\n")
	}

	return sb.String()
}

func (m ChatModel) View() string {
	var sb strings.Builder

	sb.WriteString(m.viewport.View())
	sb.WriteString("\n")

	inputBox := m.inputStyle.Render(m.input.View())
	sb.WriteString(inputBox)

	return sb.String()
}

func (m ChatModel) Messages() []ChatMessage {
	return m.messages
}

func (m ChatModel) IsStreaming() bool {
	return m.isStreaming
}

func (m ChatModel) InputValue() string {
	return m.input.Value()
}

func wordWrap(s string, width int) string {
	if width <= 0 {
		return s
	}

	var result strings.Builder
	lines := strings.Split(s, "\n")

	for i, line := range lines {
		if i > 0 {
			result.WriteString("\n")
		}

		if len(line) <= width {
			result.WriteString(line)
			continue
		}

		words := strings.Fields(line)
		if len(words) == 0 {
			continue
		}

		currentLine := words[0]
		for _, word := range words[1:] {
			if len(currentLine)+1+len(word) <= width {
				currentLine += " " + word
			} else {
				result.WriteString(currentLine)
				result.WriteString("\n")
				currentLine = word
			}
		}
		result.WriteString(currentLine)
	}

	return result.String()
}

type ChatHistory struct {
	Messages  []ChatMessage
	SessionID string
	Title     string
	CreatedAt time.Time
	UpdatedAt time.Time
}

func (m *ChatModel) ExportHistory() ChatHistory {
	return ChatHistory{
		Messages:  m.messages,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

func (m *ChatModel) ImportHistory(history ChatHistory) {
	m.messages = history.Messages
	m.renderMessages()
	m.viewport.GotoBottom()
}
