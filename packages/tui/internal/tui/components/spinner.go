package components

import (
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// SpinnerType defines different spinner animation styles
type SpinnerType int

const (
	SpinnerDots SpinnerType = iota
	SpinnerLine
	SpinnerPulse
	SpinnerBounce
	SpinnerGlobe
	SpinnerMoon
	SpinnerMonkey
	SpinnerMeter
	SpinnerHamburger
)

var spinnerFrames = map[SpinnerType][]string{
	SpinnerDots:      {"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"},
	SpinnerLine:      {"|", "/", "-", "\\"},
	SpinnerPulse:     {"█", "▓", "▒", "░", "▒", "▓"},
	SpinnerBounce:    {"⠁", "⠂", "⠄", "⠂"},
	SpinnerGlobe:     {"🌍", "🌎", "🌏"},
	SpinnerMoon:      {"🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"},
	SpinnerMonkey:    {"🙈", "🙉", "🙊"},
	SpinnerMeter:     {"▱▱▱", "▰▱▱", "▰▰▱", "▰▰▰", "▰▰▱", "▰▱▱"},
	SpinnerHamburger: {"☱", "☲", "☴"},
}

// SpinnerTickMsg is sent on each animation frame
type SpinnerTickMsg time.Time

// Spinner is an animated loading indicator
type Spinner struct {
	Type    SpinnerType
	Style   lipgloss.Style
	Label   string
	frame   int
	running bool
}

// NewSpinner creates a new spinner with default settings
func NewSpinner() Spinner {
	return Spinner{
		Type: SpinnerDots,
		Style: lipgloss.NewStyle().
			Foreground(lipgloss.Color("#7D56F4")),
		Label:   "",
		frame:   0,
		running: false,
	}
}

// WithType sets the spinner animation type
func (s Spinner) WithType(t SpinnerType) Spinner {
	s.Type = t
	return s
}

// WithStyle sets the spinner style
func (s Spinner) WithStyle(style lipgloss.Style) Spinner {
	s.Style = style
	return s
}

// WithLabel sets the spinner label
func (s Spinner) WithLabel(label string) Spinner {
	s.Label = label
	return s
}

// Start begins the spinner animation
func (s *Spinner) Start() tea.Cmd {
	s.running = true
	return s.tick()
}

// Stop ends the spinner animation
func (s *Spinner) Stop() {
	s.running = false
}

// IsRunning returns whether the spinner is active
func (s Spinner) IsRunning() bool {
	return s.running
}

func (s Spinner) tick() tea.Cmd {
	return tea.Tick(80*time.Millisecond, func(t time.Time) tea.Msg {
		return SpinnerTickMsg(t)
	})
}

// Update handles spinner animation
func (s Spinner) Update(msg tea.Msg) (Spinner, tea.Cmd) {
	switch msg.(type) {
	case SpinnerTickMsg:
		if s.running {
			frames := spinnerFrames[s.Type]
			s.frame = (s.frame + 1) % len(frames)
			return s, s.tick()
		}
	}
	return s, nil
}

// View renders the spinner
func (s Spinner) View() string {
	if !s.running {
		return ""
	}

	frames := spinnerFrames[s.Type]
	spinner := s.Style.Render(frames[s.frame])

	if s.Label != "" {
		return spinner + " " + s.Label
	}
	return spinner
}

// ProgressBar is a visual progress indicator
type ProgressBar struct {
	Total     int
	Current   int
	Width     int
	Style     lipgloss.Style
	FillChar  string
	EmptyChar string
}

// NewProgressBar creates a new progress bar
func NewProgressBar() ProgressBar {
	return ProgressBar{
		Total:     100,
		Current:   0,
		Width:     40,
		Style:     lipgloss.NewStyle().Foreground(lipgloss.Color("#7D56F4")),
		FillChar:  "█",
		EmptyChar: "░",
	}
}

// SetProgress updates the progress value
func (p *ProgressBar) SetProgress(current int) {
	if current < 0 {
		current = 0
	}
	if current > p.Total {
		current = p.Total
	}
	p.Current = current
}

// Percent returns the completion percentage
func (p ProgressBar) Percent() float64 {
	if p.Total == 0 {
		return 0
	}
	return float64(p.Current) / float64(p.Total) * 100
}

// View renders the progress bar
func (p ProgressBar) View() string {
	if p.Total == 0 {
		return ""
	}

	percent := p.Percent()
	filled := int(float64(p.Width) * percent / 100)
	empty := p.Width - filled

	bar := ""
	for i := 0; i < filled; i++ {
		bar += p.FillChar
	}
	for i := 0; i < empty; i++ {
		bar += p.EmptyChar
	}

	return p.Style.Render(bar) + lipgloss.NewStyle().
		Foreground(lipgloss.Color("#A9ABAC")).
		Render(" "+string(rune(int(percent)))+"%%")
}

// MultiSpinner manages multiple concurrent spinners
type MultiSpinner struct {
	Spinners map[string]*Spinner
	Style    lipgloss.Style
}

// NewMultiSpinner creates a spinner manager
func NewMultiSpinner() MultiSpinner {
	return MultiSpinner{
		Spinners: make(map[string]*Spinner),
		Style:    lipgloss.NewStyle(),
	}
}

// Add creates a new spinner with the given ID
func (ms *MultiSpinner) Add(id, label string) tea.Cmd {
	s := NewSpinner()
	s.Label = label
	ms.Spinners[id] = &s
	return s.Start()
}

// Remove stops and removes a spinner
func (ms *MultiSpinner) Remove(id string) {
	if s, ok := ms.Spinners[id]; ok {
		s.Stop()
		delete(ms.Spinners, id)
	}
}

// Update handles tick messages for all spinners
func (ms MultiSpinner) Update(msg tea.Msg) (MultiSpinner, tea.Cmd) {
	var cmds []tea.Cmd
	for id, s := range ms.Spinners {
		newS, cmd := s.Update(msg)
		ms.Spinners[id] = &newS
		if cmd != nil {
			cmds = append(cmds, cmd)
		}
	}
	return ms, tea.Batch(cmds...)
}

// View renders all active spinners
func (ms MultiSpinner) View() string {
	if len(ms.Spinners) == 0 {
		return ""
	}

	var lines []string
	for _, s := range ms.Spinners {
		if v := s.View(); v != "" {
			lines = append(lines, v)
		}
	}

	result := ""
	for _, line := range lines {
		result += line + "\n"
	}
	return result
}
