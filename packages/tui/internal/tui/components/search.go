package components

import (
	"regexp"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type SearchBar struct {
	Input        textinput.Model
	Active       bool
	Results      []SearchResult
	TotalLines   int
	CurrentMatch int
	Style        lipgloss.Style
	MatchStyle   lipgloss.Style
}

type SearchResult struct {
	LineNum int
	Line    string
	Matches [][]int
}

func NewSearchBar() SearchBar {
	ti := textinput.New()
	ti.Placeholder = "Search... (Enter to find, n/N next/prev, Esc close)"
	ti.CharLimit = 200
	ti.Width = 40

	return SearchBar{
		Input:        ti,
		Active:       false,
		Results:      []SearchResult{},
		TotalLines:   0,
		CurrentMatch: -1,
		Style: lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("#7D56F4")).
			Padding(0, 1),
		MatchStyle: lipgloss.NewStyle().
			Background(lipgloss.Color("#7D56F4")).
			Foreground(lipgloss.Color("#FFFDF5")),
	}
}

func (sb *SearchBar) Toggle() tea.Cmd {
	sb.Active = !sb.Active
	if sb.Active {
		sb.Input.Focus()
		return textinput.Blink
	}
	sb.Input.Blur()
	return nil
}

func (sb *SearchBar) Search(content string) {
	query := sb.Input.Value()
	if query == "" {
		sb.Results = []SearchResult{}
		sb.CurrentMatch = -1
		return
	}

	lines := strings.Split(content, "\n")
	sb.TotalLines = len(lines)
	sb.Results = []SearchResult{}

	re, err := regexp.Compile("(?i)" + regexp.QuoteMeta(query))
	if err != nil {
		return
	}

	for i, line := range lines {
		matches := re.FindAllStringIndex(line, -1)
		if len(matches) > 0 {
			sb.Results = append(sb.Results, SearchResult{
				LineNum: i,
				Line:    line,
				Matches: matches,
			})
		}
	}

	if len(sb.Results) > 0 && sb.CurrentMatch < 0 {
		sb.CurrentMatch = 0
	}
}

func (sb *SearchBar) NextMatch() {
	if len(sb.Results) == 0 {
		return
	}
	sb.CurrentMatch = (sb.CurrentMatch + 1) % len(sb.Results)
}

func (sb *SearchBar) PrevMatch() {
	if len(sb.Results) == 0 {
		return
	}
	sb.CurrentMatch = (sb.CurrentMatch - 1 + len(sb.Results)) % len(sb.Results)
}

func (sb *SearchBar) CurrentLineNum() int {
	if sb.CurrentMatch >= 0 && sb.CurrentMatch < len(sb.Results) {
		return sb.Results[sb.CurrentMatch].LineNum
	}
	return -1
}

func (sb SearchBar) Update(msg tea.Msg) (SearchBar, tea.Cmd) {
	if !sb.Active {
		return sb, nil
	}

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "esc":
			sb.Active = false
			sb.Input.Blur()
			return sb, nil
		case "enter":
			return sb, nil
		case "n":
			if sb.Input.Value() != "" {
				sb.NextMatch()
			}
		case "N":
			if sb.Input.Value() != "" {
				sb.PrevMatch()
			}
		}
	}

	var cmd tea.Cmd
	sb.Input, cmd = sb.Input.Update(msg)
	return sb, cmd
}

func (sb SearchBar) View() string {
	if !sb.Active {
		return ""
	}

	status := ""
	if len(sb.Results) > 0 {
		status = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#A9ABAC")).
			Render(" " + string(rune('0'+sb.CurrentMatch+1)) + "/" + string(rune('0'+len(sb.Results))))
	} else if sb.Input.Value() != "" {
		status = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#FF6B6B")).
			Render(" No matches")
	}

	return sb.Style.Render(sb.Input.View() + status)
}

func (sb SearchBar) HighlightContent(content string) string {
	if sb.Input.Value() == "" || len(sb.Results) == 0 {
		return content
	}

	query := sb.Input.Value()
	re, err := regexp.Compile("(?i)" + regexp.QuoteMeta(query))
	if err != nil {
		return content
	}

	lines := strings.Split(content, "\n")
	for i, line := range lines {
		lines[i] = re.ReplaceAllStringFunc(line, func(match string) string {
			return sb.MatchStyle.Render(match)
		})
	}

	return strings.Join(lines, "\n")
}

type FilterBar struct {
	Input   textinput.Model
	Active  bool
	Pattern string
	Style   lipgloss.Style
}

func NewFilterBar() FilterBar {
	ti := textinput.New()
	ti.Placeholder = "Filter logs... (Enter to apply, Esc to clear)"
	ti.CharLimit = 200
	ti.Width = 40

	return FilterBar{
		Input:   ti,
		Active:  false,
		Pattern: "",
		Style: lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("#04B575")).
			Padding(0, 1),
	}
}

func (fb *FilterBar) Toggle() tea.Cmd {
	fb.Active = !fb.Active
	if fb.Active {
		fb.Input.Focus()
		return textinput.Blink
	}
	fb.Input.Blur()
	return nil
}

func (fb *FilterBar) Apply() {
	fb.Pattern = fb.Input.Value()
}

func (fb *FilterBar) Clear() {
	fb.Pattern = ""
	fb.Input.Reset()
}

func (fb FilterBar) FilterLines(lines []string) []string {
	if fb.Pattern == "" {
		return lines
	}

	re, err := regexp.Compile("(?i)" + regexp.QuoteMeta(fb.Pattern))
	if err != nil {
		return lines
	}

	var filtered []string
	for _, line := range lines {
		if re.MatchString(line) {
			filtered = append(filtered, line)
		}
	}
	return filtered
}

func (fb FilterBar) Update(msg tea.Msg) (FilterBar, tea.Cmd) {
	if !fb.Active {
		return fb, nil
	}

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "esc":
			fb.Active = false
			fb.Input.Blur()
			fb.Clear()
			return fb, nil
		case "enter":
			fb.Apply()
			return fb, nil
		}
	}

	var cmd tea.Cmd
	fb.Input, cmd = fb.Input.Update(msg)
	return fb, cmd
}

func (fb FilterBar) View() string {
	if !fb.Active {
		return ""
	}

	status := ""
	if fb.Pattern != "" {
		status = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#04B575")).
			Render(" [active]")
	}

	return fb.Style.Render(fb.Input.View() + status)
}
