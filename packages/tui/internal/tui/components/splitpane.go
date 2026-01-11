package components

import (
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// Orientation defines split direction
type Orientation int

const (
	Horizontal Orientation = iota // Side by side
	Vertical                      // Top and bottom
)

// Pane represents a single pane in a split view
type Pane struct {
	ID      string
	Content string
	Title   string
	Focused bool
	MinSize int // Minimum width/height
}

// SplitPane manages a two-pane layout
type SplitPane struct {
	Orientation Orientation
	Pane1       Pane
	Pane2       Pane
	SplitRatio  float64 // 0.0 - 1.0, portion for Pane1
	Width       int
	Height      int
	FocusedPane int // 0 or 1

	// Styles
	BorderStyle   lipgloss.Style
	TitleStyle    lipgloss.Style
	FocusedStyle  lipgloss.Style
	SeparatorChar string
	ShowBorder    bool
}

// NewSplitPane creates a new split pane layout
func NewSplitPane(orientation Orientation) SplitPane {
	return SplitPane{
		Orientation: orientation,
		Pane1: Pane{
			ID:      "pane1",
			MinSize: 10,
		},
		Pane2: Pane{
			ID:      "pane2",
			MinSize: 10,
		},
		SplitRatio:  0.5,
		Width:       80,
		Height:      24,
		FocusedPane: 0,
		BorderStyle: lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.AdaptiveColor{Light: "#D9DCCF", Dark: "#383838"}),
		TitleStyle: lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#FFFDF5")).
			Background(lipgloss.Color("#3C3C3C")).
			Padding(0, 1),
		FocusedStyle: lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("#7D56F4")),
		SeparatorChar: "│",
		ShowBorder:    true,
	}
}

// SetSize updates the split pane dimensions
func (sp *SplitPane) SetSize(width, height int) {
	sp.Width = width
	sp.Height = height
}

// SetRatio sets the split ratio (0.0 - 1.0)
func (sp *SplitPane) SetRatio(ratio float64) {
	if ratio < 0.1 {
		ratio = 0.1
	}
	if ratio > 0.9 {
		ratio = 0.9
	}
	sp.SplitRatio = ratio
}

// FocusNext switches focus to the other pane
func (sp *SplitPane) FocusNext() {
	sp.FocusedPane = 1 - sp.FocusedPane
	sp.Pane1.Focused = sp.FocusedPane == 0
	sp.Pane2.Focused = sp.FocusedPane == 1
}

// SetContent sets content for a specific pane
func (sp *SplitPane) SetContent(paneIndex int, content string) {
	if paneIndex == 0 {
		sp.Pane1.Content = content
	} else {
		sp.Pane2.Content = content
	}
}

// SetTitle sets the title for a specific pane
func (sp *SplitPane) SetTitle(paneIndex int, title string) {
	if paneIndex == 0 {
		sp.Pane1.Title = title
	} else {
		sp.Pane2.Title = title
	}
}

// GetFocusedPane returns the currently focused pane
func (sp *SplitPane) GetFocusedPane() *Pane {
	if sp.FocusedPane == 0 {
		return &sp.Pane1
	}
	return &sp.Pane2
}

// Update handles keyboard navigation
func (sp SplitPane) Update(msg tea.Msg) (SplitPane, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "tab", "ctrl+w":
			sp.FocusNext()
		case "ctrl+left", "ctrl+h":
			if sp.Orientation == Horizontal {
				sp.SetRatio(sp.SplitRatio - 0.05)
			}
		case "ctrl+right", "ctrl+l":
			if sp.Orientation == Horizontal {
				sp.SetRatio(sp.SplitRatio + 0.05)
			}
		case "ctrl+up", "ctrl+k":
			if sp.Orientation == Vertical {
				sp.SetRatio(sp.SplitRatio - 0.05)
			}
		case "ctrl+down", "ctrl+j":
			if sp.Orientation == Vertical {
				sp.SetRatio(sp.SplitRatio + 0.05)
			}
		}
	case tea.WindowSizeMsg:
		sp.SetSize(msg.Width, msg.Height)
	}
	return sp, nil
}

// View renders the split pane layout
func (sp SplitPane) View() string {
	if sp.Orientation == Horizontal {
		return sp.renderHorizontal()
	}
	return sp.renderVertical()
}

func (sp SplitPane) renderHorizontal() string {
	// Calculate pane widths
	totalWidth := sp.Width
	if sp.ShowBorder {
		totalWidth -= 4 // Account for borders
	}

	pane1Width := int(float64(totalWidth) * sp.SplitRatio)
	pane2Width := totalWidth - pane1Width - 1 // -1 for separator

	// Ensure minimum sizes
	if pane1Width < sp.Pane1.MinSize {
		pane1Width = sp.Pane1.MinSize
		pane2Width = totalWidth - pane1Width - 1
	}
	if pane2Width < sp.Pane2.MinSize {
		pane2Width = sp.Pane2.MinSize
		pane1Width = totalWidth - pane2Width - 1
	}

	contentHeight := sp.Height
	if sp.ShowBorder {
		contentHeight -= 2
	}
	if sp.Pane1.Title != "" || sp.Pane2.Title != "" {
		contentHeight -= 1
	}

	// Render panes
	p1Style := sp.BorderStyle.Width(pane1Width).Height(contentHeight)
	p2Style := sp.BorderStyle.Width(pane2Width).Height(contentHeight)

	if sp.FocusedPane == 0 {
		p1Style = sp.FocusedStyle.Width(pane1Width).Height(contentHeight)
	} else {
		p2Style = sp.FocusedStyle.Width(pane2Width).Height(contentHeight)
	}

	var pane1View, pane2View string

	if sp.Pane1.Title != "" {
		pane1View = sp.TitleStyle.Render(sp.Pane1.Title) + "\n"
	}
	pane1View += truncateContent(sp.Pane1.Content, pane1Width-2, contentHeight-1)

	if sp.Pane2.Title != "" {
		pane2View = sp.TitleStyle.Render(sp.Pane2.Title) + "\n"
	}
	pane2View += truncateContent(sp.Pane2.Content, pane2Width-2, contentHeight-1)

	if sp.ShowBorder {
		pane1View = p1Style.Render(pane1View)
		pane2View = p2Style.Render(pane2View)
	}

	// Create separator
	separator := lipgloss.NewStyle().
		Foreground(lipgloss.AdaptiveColor{Light: "#D9DCCF", Dark: "#383838"}).
		Render(strings.Repeat(sp.SeparatorChar+"\n", contentHeight))

	return lipgloss.JoinHorizontal(lipgloss.Top, pane1View, separator, pane2View)
}

func (sp SplitPane) renderVertical() string {
	// Calculate pane heights
	totalHeight := sp.Height
	if sp.ShowBorder {
		totalHeight -= 4
	}

	pane1Height := int(float64(totalHeight) * sp.SplitRatio)
	pane2Height := totalHeight - pane1Height - 1 // -1 for separator

	// Ensure minimum sizes
	if pane1Height < sp.Pane1.MinSize {
		pane1Height = sp.Pane1.MinSize
		pane2Height = totalHeight - pane1Height - 1
	}
	if pane2Height < sp.Pane2.MinSize {
		pane2Height = sp.Pane2.MinSize
		pane1Height = totalHeight - pane2Height - 1
	}

	contentWidth := sp.Width
	if sp.ShowBorder {
		contentWidth -= 4
	}

	// Render panes
	p1Style := sp.BorderStyle.Width(contentWidth).Height(pane1Height)
	p2Style := sp.BorderStyle.Width(contentWidth).Height(pane2Height)

	if sp.FocusedPane == 0 {
		p1Style = sp.FocusedStyle.Width(contentWidth).Height(pane1Height)
	} else {
		p2Style = sp.FocusedStyle.Width(contentWidth).Height(pane2Height)
	}

	var pane1View, pane2View string

	if sp.Pane1.Title != "" {
		pane1View = sp.TitleStyle.Render(sp.Pane1.Title) + "\n"
	}
	pane1View += truncateContent(sp.Pane1.Content, contentWidth-2, pane1Height-2)

	if sp.Pane2.Title != "" {
		pane2View = sp.TitleStyle.Render(sp.Pane2.Title) + "\n"
	}
	pane2View += truncateContent(sp.Pane2.Content, contentWidth-2, pane2Height-2)

	if sp.ShowBorder {
		pane1View = p1Style.Render(pane1View)
		pane2View = p2Style.Render(pane2View)
	}

	// Create horizontal separator
	separator := lipgloss.NewStyle().
		Foreground(lipgloss.AdaptiveColor{Light: "#D9DCCF", Dark: "#383838"}).
		Render(strings.Repeat("─", contentWidth))

	return lipgloss.JoinVertical(lipgloss.Left, pane1View, separator, pane2View)
}

// truncateContent ensures content fits within bounds
func truncateContent(content string, width, height int) string {
	lines := strings.Split(content, "\n")

	// Limit lines
	if len(lines) > height {
		lines = lines[:height]
	}

	// Truncate each line
	for i, line := range lines {
		if len(line) > width {
			lines[i] = line[:width-3] + "..."
		}
	}

	return strings.Join(lines, "\n")
}

// TripleSplitPane manages a three-pane layout
type TripleSplitPane struct {
	Left        SplitPane // Can be a vertical split for left sidebar
	Main        Pane
	Right       Pane
	Width       int
	Height      int
	LeftRatio   float64 // Portion for left pane
	RightRatio  float64 // Portion for right pane
	FocusedPane int     // 0=left, 1=main, 2=right
}

// NewTripleSplitPane creates a three-column layout
func NewTripleSplitPane() TripleSplitPane {
	return TripleSplitPane{
		Left: NewSplitPane(Vertical),
		Main: Pane{
			ID:      "main",
			MinSize: 40,
		},
		Right: Pane{
			ID:      "right",
			MinSize: 20,
		},
		Width:       120,
		Height:      40,
		LeftRatio:   0.2,
		RightRatio:  0.2,
		FocusedPane: 1, // Main focused by default
	}
}
