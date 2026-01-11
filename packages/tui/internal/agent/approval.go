package agent

import (
	"fmt"
	"strings"
)

type RiskLevel string

const (
	RiskLow      RiskLevel = "low"
	RiskMedium   RiskLevel = "medium"
	RiskHigh     RiskLevel = "high"
	RiskCritical RiskLevel = "critical"
)

type ApprovalDecision string

const (
	DecisionApprove    ApprovalDecision = "approve"
	DecisionDeny       ApprovalDecision = "deny"
	DecisionApproveAll ApprovalDecision = "approve_all"
	DecisionDenyAll    ApprovalDecision = "deny_all"
	DecisionEdit       ApprovalDecision = "edit"
)

type ApprovalContext struct {
	Step          *Step
	Risk          RiskLevel
	Reason        string
	Diff          string
	AffectedFiles []string
	Reversible    bool
}

type ApprovalPolicy struct {
	Mode             ApprovalMode
	AutoApproveTools []string
	AutoApproveTypes []StepType
	MaxRiskLevel     RiskLevel
	RequireReason    bool
}

func DefaultApprovalPolicy(mode ApprovalMode) *ApprovalPolicy {
	switch mode {
	case ApprovalConservative:
		return &ApprovalPolicy{
			Mode:             ApprovalConservative,
			AutoApproveTools: []string{},
			AutoApproveTypes: []StepType{},
			MaxRiskLevel:     RiskLow,
			RequireReason:    true,
		}
	case ApprovalYOLO:
		return &ApprovalPolicy{
			Mode:             ApprovalYOLO,
			AutoApproveTools: []string{"*"},
			AutoApproveTypes: []StepType{StepTypeRead, StepTypeWrite, StepTypeExecute, StepTypeVerify},
			MaxRiskLevel:     RiskCritical,
			RequireReason:    false,
		}
	default:
		return &ApprovalPolicy{
			Mode:             ApprovalBalanced,
			AutoApproveTools: []string{"read_file", "list_files", "search", "grep", "find_references"},
			AutoApproveTypes: []StepType{StepTypeRead, StepTypeVerify},
			MaxRiskLevel:     RiskMedium,
			RequireReason:    false,
		}
	}
}

func (p *ApprovalPolicy) ShouldAutoApprove(step *Step, risk RiskLevel) bool {
	if p.Mode == ApprovalYOLO {
		return true
	}

	if p.Mode == ApprovalConservative {
		return false
	}

	if !p.isRiskAcceptable(risk) {
		return false
	}

	for _, t := range p.AutoApproveTypes {
		if step.Type == t {
			return true
		}
	}

	for _, tool := range p.AutoApproveTools {
		if tool == "*" || tool == step.Tool {
			return true
		}
	}

	return false
}

func (p *ApprovalPolicy) isRiskAcceptable(risk RiskLevel) bool {
	riskOrder := map[RiskLevel]int{
		RiskLow:      0,
		RiskMedium:   1,
		RiskHigh:     2,
		RiskCritical: 3,
	}

	return riskOrder[risk] <= riskOrder[p.MaxRiskLevel]
}

func AssessStepRisk(step *Step) RiskLevel {
	switch step.Type {
	case StepTypeRead, StepTypeVerify:
		return RiskLow

	case StepTypeWrite:
		if isDestructiveWrite(step) {
			return RiskHigh
		}
		return RiskMedium

	case StepTypeExecute:
		if isDangerousCommand(step) {
			return RiskCritical
		}
		if isModifyingCommand(step) {
			return RiskHigh
		}
		return RiskMedium
	}

	return RiskMedium
}

func isDestructiveWrite(step *Step) bool {
	destructivePatterns := []string{
		".env", "credentials", "secret", "password", "token",
		"config.yaml", "config.json", ".gitignore",
		"package.json", "go.mod", "Cargo.toml", "requirements.txt",
	}

	if path, ok := step.Args["path"].(string); ok {
		pathLower := strings.ToLower(path)
		for _, pattern := range destructivePatterns {
			if strings.Contains(pathLower, pattern) {
				return true
			}
		}
	}

	return false
}

func isDangerousCommand(step *Step) bool {
	dangerous := []string{
		"rm -rf", "rm -r", "rmdir",
		"drop database", "drop table", "truncate",
		"chmod 777", "chown",
		"sudo", "su ",
		"curl | sh", "curl | bash", "wget | sh",
		"> /dev/", "dd if=",
		"format", "mkfs",
		"shutdown", "reboot", "halt",
	}

	if cmd, ok := step.Args["command"].(string); ok {
		cmdLower := strings.ToLower(cmd)
		for _, d := range dangerous {
			if strings.Contains(cmdLower, d) {
				return true
			}
		}
	}

	return false
}

func isModifyingCommand(step *Step) bool {
	modifying := []string{
		"git push", "git commit", "git reset", "git checkout",
		"npm publish", "yarn publish",
		"docker push", "docker rm",
		"kubectl apply", "kubectl delete",
		"terraform apply", "terraform destroy",
		"make install", "make deploy",
	}

	if cmd, ok := step.Args["command"].(string); ok {
		cmdLower := strings.ToLower(cmd)
		for _, m := range modifying {
			if strings.Contains(cmdLower, m) {
				return true
			}
		}
	}

	return false
}

func GenerateDiffPreview(step *Step) string {
	switch step.Type {
	case StepTypeWrite:
		return generateWriteDiff(step)
	case StepTypeExecute:
		return generateCommandPreview(step)
	default:
		return ""
	}
}

func generateWriteDiff(step *Step) string {
	var sb strings.Builder

	path := "<unknown>"
	if p, ok := step.Args["path"].(string); ok {
		path = p
	}

	content := ""
	if c, ok := step.Args["content"].(string); ok {
		content = c
	}

	sb.WriteString(fmt.Sprintf("📝 Write to: %s\n", path))
	sb.WriteString("─────────────────────────────\n")

	lines := strings.Split(content, "\n")
	maxLines := 20
	if len(lines) > maxLines {
		for i := 0; i < maxLines/2; i++ {
			sb.WriteString(fmt.Sprintf("+ %s\n", lines[i]))
		}
		sb.WriteString(fmt.Sprintf("... (%d more lines) ...\n", len(lines)-maxLines))
		for i := len(lines) - maxLines/2; i < len(lines); i++ {
			sb.WriteString(fmt.Sprintf("+ %s\n", lines[i]))
		}
	} else {
		for _, line := range lines {
			sb.WriteString(fmt.Sprintf("+ %s\n", line))
		}
	}

	return sb.String()
}

func generateCommandPreview(step *Step) string {
	var sb strings.Builder

	cmd := "<unknown>"
	if c, ok := step.Args["command"].(string); ok {
		cmd = c
	}

	dir := "."
	if d, ok := step.Args["dir"].(string); ok {
		dir = d
	}

	sb.WriteString("🖥️  Execute Command\n")
	sb.WriteString("─────────────────────────────\n")
	sb.WriteString(fmt.Sprintf("Directory: %s\n", dir))
	sb.WriteString(fmt.Sprintf("Command:   %s\n", cmd))

	return sb.String()
}

func FormatApprovalRequest(ctx *ApprovalContext) string {
	var sb strings.Builder

	riskEmoji := map[RiskLevel]string{
		RiskLow:      "🟢",
		RiskMedium:   "🟡",
		RiskHigh:     "🟠",
		RiskCritical: "🔴",
	}

	sb.WriteString("┌─────────────────────────────────────┐\n")
	sb.WriteString("│         APPROVAL REQUIRED           │\n")
	sb.WriteString("└─────────────────────────────────────┘\n\n")

	sb.WriteString(fmt.Sprintf("Step: %s\n", ctx.Step.Description))
	sb.WriteString(fmt.Sprintf("Tool: %s\n", ctx.Step.Tool))
	sb.WriteString(fmt.Sprintf("Risk: %s %s\n", riskEmoji[ctx.Risk], ctx.Risk))

	if ctx.Reason != "" {
		sb.WriteString(fmt.Sprintf("Reason: %s\n", ctx.Reason))
	}

	if len(ctx.AffectedFiles) > 0 {
		sb.WriteString("\nAffected files:\n")
		for _, f := range ctx.AffectedFiles {
			sb.WriteString(fmt.Sprintf("  • %s\n", f))
		}
	}

	if ctx.Diff != "" {
		sb.WriteString("\n")
		sb.WriteString(ctx.Diff)
	}

	sb.WriteString("\n─────────────────────────────────────\n")
	sb.WriteString("[y] Approve  [n] Deny  [a] Approve all  [d] Deny all  [e] Edit\n")

	return sb.String()
}

type ApprovalHistory struct {
	Decisions []ApprovalRecord
}

type ApprovalRecord struct {
	StepID   string           `json:"step_id"`
	Tool     string           `json:"tool"`
	Decision ApprovalDecision `json:"decision"`
	Risk     RiskLevel        `json:"risk"`
	Reason   string           `json:"reason,omitempty"`
}

func NewApprovalHistory() *ApprovalHistory {
	return &ApprovalHistory{
		Decisions: make([]ApprovalRecord, 0),
	}
}

func (h *ApprovalHistory) Record(stepID, tool string, decision ApprovalDecision, risk RiskLevel, reason string) {
	h.Decisions = append(h.Decisions, ApprovalRecord{
		StepID:   stepID,
		Tool:     tool,
		Decision: decision,
		Risk:     risk,
		Reason:   reason,
	})
}

func (h *ApprovalHistory) GetStats() (approved, denied, total int) {
	total = len(h.Decisions)
	for _, d := range h.Decisions {
		if d.Decision == DecisionApprove || d.Decision == DecisionApproveAll {
			approved++
		} else if d.Decision == DecisionDeny || d.Decision == DecisionDenyAll {
			denied++
		}
	}
	return
}
