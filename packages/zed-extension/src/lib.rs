use zed_extension_api::{self as zed, Result, Command, CodeLabel, Worktree};
use serde::{Deserialize, Serialize};

/// AIOS Extension for Zed Editor
/// Provides AI Council integration via slash commands and context providers
struct AiosExtension {
    hub_url: String,
}

// ============================================================================
// Request/Response Types
// ============================================================================

#[derive(Serialize)]
struct DebateTask {
    id: String,
    description: String,
    files: Vec<String>,
    context: String,
}

#[derive(Serialize)]
struct DebateRequest {
    task: DebateTask,
}

#[derive(Deserialize)]
struct DebateResult {
    decision: String,
    #[serde(rename = "consensusLevel")]
    consensus_level: f64,
    reasoning: String,
    votes: Option<Vec<Vote>>,
}

#[derive(Deserialize)]
struct Vote {
    supervisor: String,
    vote: String,
    confidence: f64,
    reasoning: String,
}

#[derive(Serialize)]
struct ArchitectRequest {
    task: String,
    context: Option<String>,
    files: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct ArchitectSession {
    #[serde(rename = "sessionId")]
    session_id: String,
    status: String,
    #[serde(rename = "reasoningOutput")]
    reasoning_output: Option<String>,
    plan: Option<EditPlan>,
}

#[derive(Deserialize)]
struct EditPlan {
    description: String,
    complexity: String,
    files: Vec<String>,
    steps: Vec<String>,
}

#[derive(Deserialize)]
struct AnalyticsSummary {
    #[serde(rename = "totalSupervisors")]
    total_supervisors: i32,
    #[serde(rename = "totalDebates")]
    total_debates: i32,
    #[serde(rename = "totalApproved")]
    total_approved: i32,
    #[serde(rename = "totalRejected")]
    total_rejected: i32,
    #[serde(rename = "avgConsensus")]
    avg_consensus: Option<f64>,
    #[serde(rename = "avgConfidence")]
    avg_confidence: Option<f64>,
}

#[derive(Deserialize)]
struct AnalyticsResponse {
    summary: AnalyticsSummary,
}

#[derive(Deserialize)]
struct DebateTemplate {
    id: String,
    name: String,
    description: Option<String>,
    supervisors: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct TemplatesResponse {
    templates: Vec<DebateTemplate>,
}

#[derive(Deserialize)]
struct WorktreeInfo {
    name: String,
    path: String,
    branch: String,
    #[serde(rename = "isMain")]
    is_main: bool,
}

#[derive(Deserialize)]
struct WorktreesResponse {
    worktrees: Vec<WorktreeInfo>,
}

#[derive(Deserialize)]
struct HealthResponse {
    status: String,
    version: Option<String>,
    uptime: Option<u64>,
}

// ============================================================================
// Extension Implementation
// ============================================================================

impl AiosExtension {
    fn new() -> Self {
        Self {
            hub_url: std::env::var("AIOS_HUB_URL")
                .unwrap_or_else(|_| "http://localhost:3000".to_string()),
        }
    }

    /// HTTP GET request helper
    fn http_get(&self, path: &str) -> Result<String> {
        let url = format!("{}{}", self.hub_url, path);
        
        // Use ureq for HTTP requests (bundled with Zed extensions)
        let response = ureq::get(&url)
            .set("Accept", "application/json")
            .call()
            .map_err(|e| format!("HTTP request failed: {}", e))?;
        
        response.into_string()
            .map_err(|e| format!("Failed to read response: {}", e))
    }

    /// HTTP POST request helper
    fn http_post(&self, path: &str, body: &str) -> Result<String> {
        let url = format!("{}{}", self.hub_url, path);
        
        let response = ureq::post(&url)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send_string(body)
            .map_err(|e| format!("HTTP request failed: {}", e))?;
        
        response.into_string()
            .map_err(|e| format!("Failed to read response: {}", e))
    }

    /// Check connection to AIOS hub
    fn check_health(&self) -> Result<HealthResponse> {
        let response = self.http_get("/api/health")?;
        serde_json::from_str(&response)
            .map_err(|e| format!("Failed to parse health response: {}", e))
    }

    /// Start a council debate
    fn start_debate(&self, description: &str, context: &str, files: Vec<String>) -> Result<String> {
        let task = DebateTask {
            id: format!("zed-{}", timestamp_millis()),
            description: description.to_string(),
            files,
            context: context.chars().take(10000).collect(),
        };

        let request = DebateRequest { task };
        let body = serde_json::to_string(&request).map_err(|e| e.to_string())?;
        let response = self.http_post("/api/council/debate", &body)?;

        let result: DebateResult = serde_json::from_str(&response)
            .map_err(|e| format!("Failed to parse debate response: {}", e))?;

        let mut output = format!(
            "## Council Debate Result\n\n\
            **Decision:** {}\n\
            **Consensus:** {:.1}%\n\n\
            ### Reasoning\n{}\n",
            result.decision,
            result.consensus_level,
            result.reasoning
        );

        // Include individual votes if available
        if let Some(votes) = result.votes {
            output.push_str("\n### Supervisor Votes\n");
            for vote in votes {
                output.push_str(&format!(
                    "\n**{}** - {} ({:.0}%)\n> {}\n",
                    vote.supervisor,
                    vote.vote,
                    vote.confidence * 100.0,
                    vote.reasoning
                ));
            }
        }

        Ok(output)
    }

    /// Start an architect session
    fn start_architect(&self, task: &str, context: Option<String>, files: Option<Vec<String>>) -> Result<String> {
        let request = ArchitectRequest {
            task: task.to_string(),
            context,
            files,
        };
        let body = serde_json::to_string(&request).map_err(|e| e.to_string())?;
        let response = self.http_post("/api/architect/sessions", &body)?;

        let session: ArchitectSession = serde_json::from_str(&response)
            .map_err(|e| format!("Failed to parse architect response: {}", e))?;

        let mut output = format!(
            "## Architect Session\n\n\
            **Session ID:** `{}`\n\
            **Status:** {}\n",
            session.session_id,
            session.status
        );

        if let Some(reasoning) = session.reasoning_output {
            output.push_str(&format!("\n### Reasoning Output\n{}\n", reasoning));
        }

        if let Some(plan) = session.plan {
            output.push_str(&format!(
                "\n### Edit Plan\n\
                **Description:** {}\n\
                **Complexity:** {}\n\n\
                **Files to modify:**\n",
                plan.description,
                plan.complexity
            ));
            for file in &plan.files {
                output.push_str(&format!("- `{}`\n", file));
            }
            output.push_str("\n**Steps:**\n");
            for (i, step) in plan.steps.iter().enumerate() {
                output.push_str(&format!("{}. {}\n", i + 1, step));
            }
            output.push_str(&format!(
                "\n> To approve this plan, use `/aios-approve {}`\n",
                session.session_id
            ));
        }

        Ok(output)
    }

    /// Approve an architect plan
    fn approve_plan(&self, session_id: &str) -> Result<String> {
        let response = self.http_post(
            &format!("/api/architect/sessions/{}/approve", session_id),
            "{}"
        )?;

        let session: ArchitectSession = serde_json::from_str(&response)
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        Ok(format!(
            "## Plan Approved\n\n\
            **Session:** `{}`\n\
            **Status:** {}\n\n\
            The editing phase has begun. Edits will be generated for the planned files.",
            session.session_id,
            session.status
        ))
    }

    /// Get supervisor analytics
    fn get_analytics(&self) -> Result<String> {
        let response = self.http_get("/api/supervisor-analytics/summary")?;

        let data: AnalyticsResponse = serde_json::from_str(&response)
            .map_err(|e| format!("Failed to parse analytics response: {}", e))?;
        
        let s = data.summary;
        let approval_rate = if s.total_debates > 0 {
            (s.total_approved as f64 / s.total_debates as f64) * 100.0
        } else {
            0.0
        };

        Ok(format!(
            "## Supervisor Analytics\n\n\
            | Metric | Value |\n\
            |--------|-------|\n\
            | Total Supervisors | {} |\n\
            | Total Debates | {} |\n\
            | Approved | {} |\n\
            | Rejected | {} |\n\
            | Approval Rate | {:.1}% |\n\
            | Avg Consensus | {} |\n\
            | Avg Confidence | {} |",
            s.total_supervisors,
            s.total_debates,
            s.total_approved,
            s.total_rejected,
            approval_rate,
            s.avg_consensus.map(|v| format!("{:.1}%", v)).unwrap_or_else(|| "N/A".to_string()),
            s.avg_confidence.map(|v| format!("{:.1}%", v * 100.0)).unwrap_or_else(|| "N/A".to_string())
        ))
    }

    /// Get debate templates
    fn get_templates(&self) -> Result<String> {
        let response = self.http_get("/api/debate-templates")?;

        let data: TemplatesResponse = serde_json::from_str(&response)
            .map_err(|e| format!("Failed to parse templates response: {}", e))?;

        let mut output = String::from("## Debate Templates\n\n");
        
        if data.templates.is_empty() {
            output.push_str("No templates available.\n");
        } else {
            for template in data.templates {
                output.push_str(&format!(
                    "### {} (`{}`)\n{}\n",
                    template.name,
                    template.id,
                    template.description.as_deref().unwrap_or("No description")
                ));
                if let Some(supervisors) = template.supervisors {
                    output.push_str(&format!("Supervisors: {}\n", supervisors.join(", ")));
                }
                output.push('\n');
            }
        }

        Ok(output)
    }

    /// List git worktrees
    fn list_worktrees(&self) -> Result<String> {
        let response = self.http_get("/api/worktrees")?;

        let data: WorktreesResponse = serde_json::from_str(&response)
            .map_err(|e| format!("Failed to parse worktrees response: {}", e))?;

        let mut output = String::from("## Git Worktrees\n\n");
        
        if data.worktrees.is_empty() {
            output.push_str("No worktrees found.\n");
        } else {
            output.push_str("| Name | Branch | Main | Path |\n");
            output.push_str("|------|--------|------|------|\n");
            for wt in data.worktrees {
                output.push_str(&format!(
                    "| {} | {} | {} | `{}` |\n",
                    wt.name,
                    wt.branch,
                    if wt.is_main { "✓" } else { "" },
                    wt.path
                ));
            }
        }

        Ok(output)
    }
}

// ============================================================================
// Zed Extension Trait Implementation
// ============================================================================

impl zed::Extension for AiosExtension {
    fn new() -> Self {
        Self::new()
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &zed::LanguageServerId,
        _worktree: &Worktree,
    ) -> Result<Command> {
        // AIOS doesn't provide a language server, return error to skip
        Err("AIOS does not provide a language server".into())
    }
}

// Register the extension
zed::register_extension!(AiosExtension);

// ============================================================================
// Utility Functions
// ============================================================================

/// Get current timestamp in milliseconds
fn timestamp_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

// ============================================================================
// Command Handlers (for future slash command support)
// ============================================================================

/// Command registry for AIOS slash commands
/// These will be registered when Zed adds slash command support to the extension API
pub mod commands {
    use super::*;

    /// /aios-debate <description>
    /// Start a council debate on the given topic
    pub fn debate(ext: &AiosExtension, args: &str, context: &str) -> Result<String> {
        if args.is_empty() {
            return Err("Usage: /aios-debate <description>".into());
        }
        ext.start_debate(args, context, vec![])
    }

    /// /aios-architect <task>
    /// Start an architect session for complex implementations
    pub fn architect(ext: &AiosExtension, args: &str) -> Result<String> {
        if args.is_empty() {
            return Err("Usage: /aios-architect <task description>".into());
        }
        ext.start_architect(args, None, None)
    }

    /// /aios-approve <session_id>
    /// Approve an architect plan
    pub fn approve(ext: &AiosExtension, args: &str) -> Result<String> {
        if args.is_empty() {
            return Err("Usage: /aios-approve <session_id>".into());
        }
        ext.approve_plan(args.trim())
    }

    /// /aios-analytics
    /// Show supervisor analytics summary
    pub fn analytics(ext: &AiosExtension) -> Result<String> {
        ext.get_analytics()
    }

    /// /aios-templates
    /// List available debate templates
    pub fn templates(ext: &AiosExtension) -> Result<String> {
        ext.get_templates()
    }

    /// /aios-worktrees
    /// List git worktrees
    pub fn worktrees(ext: &AiosExtension) -> Result<String> {
        ext.list_worktrees()
    }

    /// /aios-health
    /// Check AIOS hub connection
    pub fn health(ext: &AiosExtension) -> Result<String> {
        match ext.check_health() {
            Ok(h) => Ok(format!(
                "## AIOS Health\n\n\
                **Status:** {}\n\
                **Version:** {}\n\
                **Uptime:** {}s",
                h.status,
                h.version.unwrap_or_else(|| "unknown".to_string()),
                h.uptime.unwrap_or(0)
            )),
            Err(e) => Ok(format!(
                "## AIOS Health\n\n\
                **Status:** Disconnected\n\
                **Error:** {}\n\n\
                Make sure AIOS hub is running at `{}`",
                e,
                ext.hub_url
            )),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_timestamp() {
        let ts = timestamp_millis();
        assert!(ts > 0);
    }

    #[test]
    fn test_extension_creation() {
        let ext = AiosExtension::new();
        assert!(!ext.hub_url.is_empty());
    }
}
