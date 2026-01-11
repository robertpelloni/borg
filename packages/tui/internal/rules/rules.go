package rules

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

type Rule struct {
	Name        string   `yaml:"name,omitempty"`
	Description string   `yaml:"description,omitempty"`
	Globs       []string `yaml:"globs,omitempty"`
	AlwaysApply bool     `yaml:"always_apply,omitempty"`
	Content     string   `yaml:"-"`
	FilePath    string   `yaml:"-"`
}

type RuleSet struct {
	Rules     []*Rule
	rulesDir  string
	globalDir string
}

func NewRuleSet(projectDir string) *RuleSet {
	return &RuleSet{
		Rules:     make([]*Rule, 0),
		rulesDir:  filepath.Join(projectDir, ".superai", "rules"),
		globalDir: getGlobalRulesDir(),
	}
}

func getGlobalRulesDir() string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(homeDir, ".superai", "rules")
}

func (rs *RuleSet) Load() error {
	rs.Rules = make([]*Rule, 0)

	if rs.globalDir != "" {
		if err := rs.loadFromDir(rs.globalDir); err != nil && !os.IsNotExist(err) {
			return fmt.Errorf("loading global rules: %w", err)
		}
	}

	if err := rs.loadFromDir(rs.rulesDir); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("loading project rules: %w", err)
	}

	return nil
}

func (rs *RuleSet) loadFromDir(dir string) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := entry.Name()
		if !strings.HasSuffix(name, ".mdc") && !strings.HasSuffix(name, ".md") {
			continue
		}

		filePath := filepath.Join(dir, name)
		rule, err := ParseRuleFile(filePath)
		if err != nil {
			return fmt.Errorf("parsing %s: %w", filePath, err)
		}

		rs.Rules = append(rs.Rules, rule)
	}

	return nil
}

func ParseRuleFile(filePath string) (*Rule, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	rule := &Rule{
		FilePath: filePath,
		Name:     strings.TrimSuffix(filepath.Base(filePath), filepath.Ext(filePath)),
	}

	scanner := bufio.NewScanner(file)
	var frontmatter strings.Builder
	var content strings.Builder
	inFrontmatter := false
	frontmatterDone := false
	lineNum := 0

	for scanner.Scan() {
		line := scanner.Text()
		lineNum++

		if lineNum == 1 && line == "---" {
			inFrontmatter = true
			continue
		}

		if inFrontmatter && line == "---" {
			inFrontmatter = false
			frontmatterDone = true
			continue
		}

		if inFrontmatter {
			frontmatter.WriteString(line)
			frontmatter.WriteString("\n")
		} else {
			content.WriteString(line)
			content.WriteString("\n")
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	if frontmatterDone {
		if err := yaml.Unmarshal([]byte(frontmatter.String()), rule); err != nil {
			return nil, fmt.Errorf("parsing frontmatter: %w", err)
		}
	}

	rule.Content = strings.TrimSpace(content.String())

	return rule, nil
}

func (rs *RuleSet) GetRulesForFile(filePath string) []*Rule {
	var matched []*Rule

	for _, rule := range rs.Rules {
		if rule.AlwaysApply {
			matched = append(matched, rule)
			continue
		}

		if len(rule.Globs) == 0 {
			continue
		}

		for _, pattern := range rule.Globs {
			match, err := matchGlob(pattern, filePath)
			if err != nil {
				continue
			}
			if match {
				matched = append(matched, rule)
				break
			}
		}
	}

	return matched
}

func (rs *RuleSet) GetAlwaysApplyRules() []*Rule {
	var always []*Rule
	for _, rule := range rs.Rules {
		if rule.AlwaysApply {
			always = append(always, rule)
		}
	}
	return always
}

func matchGlob(pattern, path string) (bool, error) {
	path = filepath.ToSlash(path)
	pattern = filepath.ToSlash(pattern)

	if strings.HasPrefix(pattern, "**/") {
		suffix := pattern[3:]
		if matched, _ := filepath.Match(suffix, filepath.Base(path)); matched {
			return true, nil
		}
		parts := strings.Split(path, "/")
		for i := range parts {
			subPath := strings.Join(parts[i:], "/")
			if matched, _ := filepath.Match(suffix, subPath); matched {
				return true, nil
			}
		}
		return false, nil
	}

	if strings.Contains(pattern, "**") {
		parts := strings.Split(pattern, "**")
		if len(parts) == 2 {
			prefix := strings.TrimSuffix(parts[0], "/")
			suffix := strings.TrimPrefix(parts[1], "/")

			if prefix != "" && !strings.HasPrefix(path, prefix) {
				return false, nil
			}

			if suffix != "" {
				if matched, _ := filepath.Match(suffix, filepath.Base(path)); matched {
					return true, nil
				}
				pathParts := strings.Split(path, "/")
				for i := range pathParts {
					subPath := strings.Join(pathParts[i:], "/")
					if matched, _ := filepath.Match(suffix, subPath); matched {
						return true, nil
					}
				}
				return false, nil
			}

			return true, nil
		}
	}

	return filepath.Match(pattern, path)
}

func (rs *RuleSet) BuildContext(files []string) string {
	var sb strings.Builder
	seen := make(map[string]bool)

	for _, rule := range rs.GetAlwaysApplyRules() {
		if seen[rule.FilePath] {
			continue
		}
		seen[rule.FilePath] = true
		sb.WriteString(fmt.Sprintf("# Rule: %s\n\n", rule.Name))
		sb.WriteString(rule.Content)
		sb.WriteString("\n\n---\n\n")
	}

	for _, file := range files {
		for _, rule := range rs.GetRulesForFile(file) {
			if seen[rule.FilePath] {
				continue
			}
			seen[rule.FilePath] = true
			sb.WriteString(fmt.Sprintf("# Rule: %s (matched: %s)\n\n", rule.Name, file))
			sb.WriteString(rule.Content)
			sb.WriteString("\n\n---\n\n")
		}
	}

	return strings.TrimSuffix(sb.String(), "---\n\n")
}

func (rs *RuleSet) CreateRule(name string, globs []string, alwaysApply bool, content string) error {
	if err := os.MkdirAll(rs.rulesDir, 0755); err != nil {
		return err
	}

	filePath := filepath.Join(rs.rulesDir, name+".mdc")

	var sb strings.Builder
	sb.WriteString("---\n")

	frontmatter := map[string]interface{}{
		"description": name + " rules",
	}
	if len(globs) > 0 {
		frontmatter["globs"] = globs
	}
	if alwaysApply {
		frontmatter["always_apply"] = true
	}

	fmBytes, err := yaml.Marshal(frontmatter)
	if err != nil {
		return err
	}
	sb.Write(fmBytes)
	sb.WriteString("---\n\n")
	sb.WriteString(content)

	return os.WriteFile(filePath, []byte(sb.String()), 0644)
}

func (rs *RuleSet) DeleteRule(name string) error {
	filePath := filepath.Join(rs.rulesDir, name+".mdc")
	if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
		return err
	}

	filePath = filepath.Join(rs.rulesDir, name+".md")
	if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
		return err
	}

	return nil
}

func (rs *RuleSet) ListRules() []RuleSummary {
	summaries := make([]RuleSummary, 0, len(rs.Rules))
	for _, rule := range rs.Rules {
		summaries = append(summaries, RuleSummary{
			Name:        rule.Name,
			Description: rule.Description,
			Globs:       rule.Globs,
			AlwaysApply: rule.AlwaysApply,
			FilePath:    rule.FilePath,
		})
	}
	return summaries
}

type RuleSummary struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Globs       []string `json:"globs"`
	AlwaysApply bool     `json:"always_apply"`
	FilePath    string   `json:"file_path"`
}
