package components

import (
	"regexp"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

type SyntaxTheme struct {
	Keyword  lipgloss.Style
	String   lipgloss.Style
	Number   lipgloss.Style
	Comment  lipgloss.Style
	Function lipgloss.Style
	Operator lipgloss.Style
	Type     lipgloss.Style
	Variable lipgloss.Style
	Constant lipgloss.Style
	Bracket  lipgloss.Style
	Error    lipgloss.Style
	LineNum  lipgloss.Style
}

func DefaultTheme() SyntaxTheme {
	return SyntaxTheme{
		Keyword:  lipgloss.NewStyle().Foreground(lipgloss.Color("#FF79C6")),
		String:   lipgloss.NewStyle().Foreground(lipgloss.Color("#F1FA8C")),
		Number:   lipgloss.NewStyle().Foreground(lipgloss.Color("#BD93F9")),
		Comment:  lipgloss.NewStyle().Foreground(lipgloss.Color("#6272A4")).Italic(true),
		Function: lipgloss.NewStyle().Foreground(lipgloss.Color("#50FA7B")),
		Operator: lipgloss.NewStyle().Foreground(lipgloss.Color("#FF79C6")),
		Type:     lipgloss.NewStyle().Foreground(lipgloss.Color("#8BE9FD")),
		Variable: lipgloss.NewStyle().Foreground(lipgloss.Color("#F8F8F2")),
		Constant: lipgloss.NewStyle().Foreground(lipgloss.Color("#BD93F9")),
		Bracket:  lipgloss.NewStyle().Foreground(lipgloss.Color("#F8F8F2")),
		Error:    lipgloss.NewStyle().Foreground(lipgloss.Color("#FF5555")).Bold(true),
		LineNum:  lipgloss.NewStyle().Foreground(lipgloss.Color("#6272A4")),
	}
}

func MonokaiTheme() SyntaxTheme {
	return SyntaxTheme{
		Keyword:  lipgloss.NewStyle().Foreground(lipgloss.Color("#F92672")),
		String:   lipgloss.NewStyle().Foreground(lipgloss.Color("#E6DB74")),
		Number:   lipgloss.NewStyle().Foreground(lipgloss.Color("#AE81FF")),
		Comment:  lipgloss.NewStyle().Foreground(lipgloss.Color("#75715E")).Italic(true),
		Function: lipgloss.NewStyle().Foreground(lipgloss.Color("#A6E22E")),
		Operator: lipgloss.NewStyle().Foreground(lipgloss.Color("#F92672")),
		Type:     lipgloss.NewStyle().Foreground(lipgloss.Color("#66D9EF")),
		Variable: lipgloss.NewStyle().Foreground(lipgloss.Color("#F8F8F2")),
		Constant: lipgloss.NewStyle().Foreground(lipgloss.Color("#AE81FF")),
		Bracket:  lipgloss.NewStyle().Foreground(lipgloss.Color("#F8F8F2")),
		Error:    lipgloss.NewStyle().Foreground(lipgloss.Color("#F92672")).Bold(true),
		LineNum:  lipgloss.NewStyle().Foreground(lipgloss.Color("#75715E")),
	}
}

type CodeHighlighter struct {
	Theme           SyntaxTheme
	ShowLineNumbers bool
	TabWidth        int
}

func NewCodeHighlighter() CodeHighlighter {
	return CodeHighlighter{
		Theme:           DefaultTheme(),
		ShowLineNumbers: true,
		TabWidth:        4,
	}
}

var goKeywords = regexp.MustCompile(`\b(func|return|if|else|for|range|switch|case|default|break|continue|go|defer|select|chan|map|struct|interface|type|var|const|package|import|nil|true|false|make|new|len|cap|append|copy|delete|panic|recover)\b`)
var goTypes = regexp.MustCompile(`\b(string|int|int8|int16|int32|int64|uint|uint8|uint16|uint32|uint64|float32|float64|complex64|complex128|byte|rune|bool|error|any)\b`)
var pyKeywords = regexp.MustCompile(`\b(def|return|if|elif|else|for|while|in|not|and|or|is|True|False|None|class|import|from|as|try|except|finally|raise|with|yield|lambda|pass|break|continue|global|nonlocal|assert|async|await)\b`)
var jsKeywords = regexp.MustCompile(`\b(function|return|if|else|for|while|do|switch|case|default|break|continue|var|let|const|class|extends|new|this|super|import|export|from|as|try|catch|finally|throw|async|await|yield|typeof|instanceof|null|undefined|true|false|NaN|Infinity)\b`)
var stringPattern = regexp.MustCompile(`"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'` + "|`[^`]*`")
var numberPattern = regexp.MustCompile(`\b\d+\.?\d*(?:e[+-]?\d+)?\b`)
var commentPattern = regexp.MustCompile(`//.*$|/\*[\s\S]*?\*/|#.*$`)
var funcCallPattern = regexp.MustCompile(`\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(`)

func (ch CodeHighlighter) Highlight(code string, lang string) string {
	lines := strings.Split(code, "\n")
	var result []string

	for i, line := range lines {
		highlighted := ch.highlightLine(line, lang)

		if ch.ShowLineNumbers {
			lineNum := ch.Theme.LineNum.Render(padLeft(i+1, 4) + " │ ")
			highlighted = lineNum + highlighted
		}

		result = append(result, highlighted)
	}

	return strings.Join(result, "\n")
}

func (ch CodeHighlighter) highlightLine(line string, lang string) string {
	line = strings.ReplaceAll(line, "\t", strings.Repeat(" ", ch.TabWidth))

	if strings.HasPrefix(strings.TrimSpace(line), "//") ||
		strings.HasPrefix(strings.TrimSpace(line), "#") {
		return ch.Theme.Comment.Render(line)
	}

	highlighted := line

	highlighted = stringPattern.ReplaceAllStringFunc(highlighted, func(s string) string {
		return ch.Theme.String.Render(s)
	})

	highlighted = numberPattern.ReplaceAllStringFunc(highlighted, func(s string) string {
		return ch.Theme.Number.Render(s)
	})

	var keywords *regexp.Regexp
	var types *regexp.Regexp

	switch lang {
	case "go", "golang":
		keywords = goKeywords
		types = goTypes
	case "python", "py":
		keywords = pyKeywords
	case "javascript", "js", "typescript", "ts":
		keywords = jsKeywords
	default:
		keywords = goKeywords
		types = goTypes
	}

	if keywords != nil {
		highlighted = keywords.ReplaceAllStringFunc(highlighted, func(s string) string {
			return ch.Theme.Keyword.Render(s)
		})
	}

	if types != nil {
		highlighted = types.ReplaceAllStringFunc(highlighted, func(s string) string {
			return ch.Theme.Type.Render(s)
		})
	}

	highlighted = funcCallPattern.ReplaceAllStringFunc(highlighted, func(s string) string {
		name := s[:len(s)-1]
		return ch.Theme.Function.Render(name) + "("
	})

	return highlighted
}

func padLeft(n, width int) string {
	s := ""
	for n > 0 {
		s = string(rune('0'+n%10)) + s
		n /= 10
	}
	if s == "" {
		s = "0"
	}
	for len(s) < width {
		s = " " + s
	}
	return s
}

type LogHighlighter struct {
	Theme            SyntaxTheme
	ErrorStyle       lipgloss.Style
	WarnStyle        lipgloss.Style
	InfoStyle        lipgloss.Style
	DebugStyle       lipgloss.Style
	TimeStyle        lipgloss.Style
	BracketStyle     lipgloss.Style
	ThoughtStyle     lipgloss.Style
	ActionStyle      lipgloss.Style
	ObservationStyle lipgloss.Style
	ToolNameStyle    lipgloss.Style
}

func NewLogHighlighter() LogHighlighter {
	return LogHighlighter{
		Theme:            DefaultTheme(),
		ErrorStyle:       lipgloss.NewStyle().Foreground(lipgloss.Color("#FF5555")).Bold(true),
		WarnStyle:        lipgloss.NewStyle().Foreground(lipgloss.Color("#FFB86C")),
		InfoStyle:        lipgloss.NewStyle().Foreground(lipgloss.Color("#8BE9FD")),
		DebugStyle:       lipgloss.NewStyle().Foreground(lipgloss.Color("#6272A4")),
		TimeStyle:        lipgloss.NewStyle().Foreground(lipgloss.Color("#6272A4")),
		BracketStyle:     lipgloss.NewStyle().Foreground(lipgloss.Color("#BD93F9")),
		ThoughtStyle:     lipgloss.NewStyle().Foreground(lipgloss.Color("#F1FA8C")).Bold(true),
		ActionStyle:      lipgloss.NewStyle().Foreground(lipgloss.Color("#50FA7B")).Bold(true),
		ObservationStyle: lipgloss.NewStyle().Foreground(lipgloss.Color("#8BE9FD")).Italic(true),
		ToolNameStyle:    lipgloss.NewStyle().Foreground(lipgloss.Color("#FF79C6")).Bold(true),
	}
}

var errorPattern = regexp.MustCompile(`(?i)\b(error|err|fail|failed|failure|fatal|panic|exception)\b`)
var warnPattern = regexp.MustCompile(`(?i)\b(warn|warning|caution)\b`)
var infoPattern = regexp.MustCompile(`(?i)\b(info|information|notice)\b`)
var debugPattern = regexp.MustCompile(`(?i)\b(debug|trace|verbose)\b`)
var bracketPattern = regexp.MustCompile(`\[([^\]]+)\]`)
var timePattern = regexp.MustCompile(`\d{2}:\d{2}:\d{2}|\d{4}-\d{2}-\d{2}`)
var thoughtPattern = regexp.MustCompile(`^\[Thought\]`)
var actionPattern = regexp.MustCompile(`^\[Action\]\s+(\w+):`)
var observationPattern = regexp.MustCompile(`^\[Observation\]\s+(\w+):`)

func (lh LogHighlighter) Highlight(line string) string {
	if thoughtPattern.MatchString(line) {
		return lh.ThoughtStyle.Render("[Thought]") + line[9:]
	}
	if matches := actionPattern.FindStringSubmatch(line); len(matches) > 1 {
		rest := line[len("[Action] "+matches[1]+":"):]
		return lh.ActionStyle.Render("[Action]") + " " + lh.ToolNameStyle.Render(matches[1]) + ":" + rest
	}
	if matches := observationPattern.FindStringSubmatch(line); len(matches) > 1 {
		rest := line[len("[Observation] "+matches[1]+":"):]
		return lh.ObservationStyle.Render("[Observation]") + " " + lh.ToolNameStyle.Render(matches[1]) + ":" + rest
	}

	line = bracketPattern.ReplaceAllStringFunc(line, func(s string) string {
		return lh.BracketStyle.Render(s)
	})

	line = timePattern.ReplaceAllStringFunc(line, func(s string) string {
		return lh.TimeStyle.Render(s)
	})

	line = errorPattern.ReplaceAllStringFunc(line, func(s string) string {
		return lh.ErrorStyle.Render(s)
	})

	line = warnPattern.ReplaceAllStringFunc(line, func(s string) string {
		return lh.WarnStyle.Render(s)
	})

	line = infoPattern.ReplaceAllStringFunc(line, func(s string) string {
		return lh.InfoStyle.Render(s)
	})

	line = debugPattern.ReplaceAllStringFunc(line, func(s string) string {
		return lh.DebugStyle.Render(s)
	})

	return line
}

func (lh LogHighlighter) HighlightLines(lines []string) []string {
	result := make([]string, len(lines))
	for i, line := range lines {
		result[i] = lh.Highlight(line)
	}
	return result
}
