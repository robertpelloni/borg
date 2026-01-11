package components

import (
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// Tab represents a single tab with content
type Tab struct {
	ID       string
	Title    string
	Content  string
	Badge    string // Optional notification badge
	Closable bool
}

// TabBar is a Bubble Tea component for managing tabs
type TabBar struct {
	Tabs        []Tab
	ActiveIndex int
	Width       int

	// Styles
	ActiveStyle   lipgloss.Style
	InactiveStyle lipgloss.Style
	BadgeStyle    lipgloss.Style
	BorderStyle   lipgloss.Style
}

// TabBarOption configures a TabBar
type TabBarOption func(*TabBar)

// NewTabBar creates a new tabbed interface component
func NewTabBar(opts ...TabBarOption) TabBar {
	tb := TabBar{
		Tabs:        []Tab{},
		ActiveIndex: 0,
		Width:       80,
		ActiveStyle: lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#FFFDF5")).
			Background(lipgloss.Color("#7D56F4")).
			Padding(0, 2),
		InactiveStyle: lipgloss.NewStyle().
			Foreground(lipgloss.Color("#A9ABAC")).
			Background(lipgloss.Color("#3C3C3C")).
			Padding(0, 2),
		BadgeStyle: lipgloss.NewStyle().
			Foreground(lipgloss.Color("#FF6B6B")).
			Bold(true),
		BorderStyle: lipgloss.NewStyle().
			Border(lipgloss.NormalBorder(), false, false, true, false).
			BorderForeground(lipgloss.AdaptiveColor{Light: "#D9DCCF", Dark: "#383838"}),
	}

	for _, opt := range opts {
		opt(&tb)
	}

	return tb
}

// WithWidth sets the tab bar width
func WithWidth(w int) TabBarOption {
	return func(tb *TabBar) {
		tb.Width = w
	}
}

// WithTabs sets initial tabs
func WithTabs(tabs []Tab) TabBarOption {
	return func(tb *TabBar) {
		tb.Tabs = tabs
	}
}

// AddTab adds a new tab
func (tb *TabBar) AddTab(tab Tab) {
	tb.Tabs = append(tb.Tabs, tab)
}

// RemoveTab removes a tab by index
func (tb *TabBar) RemoveTab(index int) {
	if index < 0 || index >= len(tb.Tabs) {
		return
	}
	tb.Tabs = append(tb.Tabs[:index], tb.Tabs[index+1:]...)
	if tb.ActiveIndex >= len(tb.Tabs) {
		tb.ActiveIndex = max(0, len(tb.Tabs)-1)
	}
}

// SetActive sets the active tab by index
func (tb *TabBar) SetActive(index int) {
	if index >= 0 && index < len(tb.Tabs) {
		tb.ActiveIndex = index
	}
}

// ActiveTab returns the currently active tab
func (tb *TabBar) ActiveTab() *Tab {
	if tb.ActiveIndex >= 0 && tb.ActiveIndex < len(tb.Tabs) {
		return &tb.Tabs[tb.ActiveIndex]
	}
	return nil
}

// Next moves to the next tab
func (tb *TabBar) Next() {
	if len(tb.Tabs) > 0 {
		tb.ActiveIndex = (tb.ActiveIndex + 1) % len(tb.Tabs)
	}
}

// Previous moves to the previous tab
func (tb *TabBar) Previous() {
	if len(tb.Tabs) > 0 {
		tb.ActiveIndex = (tb.ActiveIndex - 1 + len(tb.Tabs)) % len(tb.Tabs)
	}
}

// Update handles messages for tab navigation
func (tb TabBar) Update(msg tea.Msg) (TabBar, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "tab", "ctrl+tab":
			tb.Next()
		case "shift+tab":
			tb.Previous()
		case "1", "2", "3", "4", "5", "6", "7", "8", "9":
			idx := int(msg.String()[0] - '1')
			if idx < len(tb.Tabs) {
				tb.ActiveIndex = idx
			}
		case "ctrl+w":
			if len(tb.Tabs) > 0 && tb.Tabs[tb.ActiveIndex].Closable {
				tb.RemoveTab(tb.ActiveIndex)
			}
		}
	}
	return tb, nil
}

// View renders the tab bar
func (tb TabBar) View() string {
	if len(tb.Tabs) == 0 {
		return ""
	}

	var tabViews []string
	for i, tab := range tb.Tabs {
		title := tab.Title
		if tab.Badge != "" {
			title += " " + tb.BadgeStyle.Render(tab.Badge)
		}
		if tab.Closable {
			title += " ×"
		}

		if i == tb.ActiveIndex {
			tabViews = append(tabViews, tb.ActiveStyle.Render(title))
		} else {
			tabViews = append(tabViews, tb.InactiveStyle.Render(title))
		}
	}

	tabLine := strings.Join(tabViews, " ")

	// Add padding to fill width
	padding := tb.Width - lipgloss.Width(tabLine)
	if padding > 0 {
		tabLine += strings.Repeat(" ", padding)
	}

	return tb.BorderStyle.Width(tb.Width).Render(tabLine)
}

type TabContent struct {
	TabBar   TabBar
	Contents map[string]string
	Height   int
}

// NewTabContent creates a new tab content manager
func NewTabContent() TabContent {
	return TabContent{
		TabBar:   NewTabBar(),
		Contents: make(map[string]string),
		Height:   20,
	}
}

// SetContent sets content for a specific tab
func (tc *TabContent) SetContent(id string, content string) {
	tc.Contents[id] = content
}

// GetActiveContent returns the content of the active tab
func (tc *TabContent) GetActiveContent() string {
	if tab := tc.TabBar.ActiveTab(); tab != nil {
		return tc.Contents[tab.ID]
	}
	return ""
}

// View renders the tab bar and active content
func (tc TabContent) View() string {
	var sb strings.Builder
	sb.WriteString(tc.TabBar.View())
	sb.WriteString("\n")
	sb.WriteString(tc.GetActiveContent())
	return sb.String()
}
