use zed_extension_api::{self as zed, Result, SlashCommand, SlashCommandOutput, SlashCommandOutputSection};
use serde::{Deserialize, Serialize};

struct AiosExtension {
    hub_url: String,
}

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
}

#[derive(Serialize)]
struct ArchitectRequest {
    task: String,
}

#[derive(Deserialize)]
struct ArchitectSession {
    #[serde(rename = "sessionId")]
    session_id: String,
    status: String,
    #[serde(rename = "reasoningOutput")]
    reasoning_output: Option<String>,
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
}

#[derive(Deserialize)]
struct TemplatesResponse {
    templates: Vec<DebateTemplate>,
}

impl AiosExtension {
    fn new() -> Self {
        Self {
            hub_url: std::env::var("AIOS_HUB_URL")
                .unwrap_or_else(|_| "http://localhost:3000".to_string()),
        }
    }

    fn start_debate(&self, description: &str, context: &str) -> Result<String> {
        let task = DebateTask {
            id: format!("zed-{}", chrono_lite::Utc::now().timestamp_millis()),
            description: description.to_string(),
            files: vec!["current_file".to_string()],
            context: context.chars().take(10000).collect(),
        };

        let request = DebateRequest { task };
        let body = serde_json::to_string(&request).map_err(|e| e.to_string())?;

        let response = zed::fetch(&zed::HttpRequest {
            url: format!("{}/api/council/debate", self.hub_url),
            method: zed::HttpMethod::Post,
            headers: vec![("Content-Type".to_string(), "application/json".to_string())],
            body: Some(body),
        })?;

        if response.status >= 200 && response.status < 300 {
            let result: DebateResult = serde_json::from_str(&response.body)
                .map_err(|e| e.to_string())?;
            
            Ok(format!(
                "## Council Debate Result\n\n**Decision:** {}\n**Consensus:** {:.1}%\n\n### Reasoning\n{}",
                result.decision,
                result.consensus_level,
                result.reasoning
            ))
        } else {
            Err(format!("Debate request failed: {}", response.status))
        }
    }

    fn start_architect(&self, task: &str) -> Result<String> {
        let request = ArchitectRequest { task: task.to_string() };
        let body = serde_json::to_string(&request).map_err(|e| e.to_string())?;

        let response = zed::fetch(&zed::HttpRequest {
            url: format!("{}/api/architect/sessions", self.hub_url),
            method: zed::HttpMethod::Post,
            headers: vec![("Content-Type".to_string(), "application/json".to_string())],
            body: Some(body),
        })?;

        if response.status >= 200 && response.status < 300 {
            let session: ArchitectSession = serde_json::from_str(&response.body)
                .map_err(|e| e.to_string())?;
            
            Ok(format!(
                "## Architect Session\n\n**Session ID:** {}\n**Status:** {}\n\n### Reasoning Output\n{}",
                session.session_id,
                session.status,
                session.reasoning_output.unwrap_or_else(|| "Reasoning in progress...".to_string())
            ))
        } else {
            Err(format!("Architect request failed: {}", response.status))
        }
    }

    fn get_analytics(&self) -> Result<String> {
        let response = zed::fetch(&zed::HttpRequest {
            url: format!("{}/api/supervisor-analytics/summary", self.hub_url),
            method: zed::HttpMethod::Get,
            headers: vec![],
            body: None,
        })?;

        if response.status >= 200 && response.status < 300 {
            let data: AnalyticsResponse = serde_json::from_str(&response.body)
                .map_err(|e| e.to_string())?;
            let s = data.summary;
            
            Ok(format!(
                "## Supervisor Analytics\n\n- **Total Supervisors:** {}\n- **Total Debates:** {}\n- **Approved:** {}\n- **Rejected:** {}\n- **Avg Consensus:** {}",
                s.total_supervisors,
                s.total_debates,
                s.total_approved,
                s.total_rejected,
                s.avg_consensus.map(|v| format!("{:.1}%", v)).unwrap_or_else(|| "N/A".to_string())
            ))
        } else {
            Err(format!("Analytics request failed: {}", response.status))
        }
    }

    fn get_templates(&self) -> Result<String> {
        let response = zed::fetch(&zed::HttpRequest {
            url: format!("{}/api/debate-templates", self.hub_url),
            method: zed::HttpMethod::Get,
            headers: vec![],
            body: None,
        })?;

        if response.status >= 200 && response.status < 300 {
            let data: TemplatesResponse = serde_json::from_str(&response.body)
                .map_err(|e| e.to_string())?;
            
            let templates_list: Vec<String> = data.templates.iter()
                .map(|t| format!("- **{}** (`{}`): {}", 
                    t.name, 
                    t.id, 
                    t.description.as_deref().unwrap_or("No description")))
                .collect();
            
            Ok(format!("## Debate Templates\n\n{}", templates_list.join("\n")))
        } else {
            Err(format!("Templates request failed: {}", response.status))
        }
    }
}

impl zed::Extension for AiosExtension {
    fn new() -> Self {
        Self::new()
    }

    fn run_slash_command(
        &self,
        command: SlashCommand,
        _args: Vec<String>,
        _worktree: Option<&zed::Worktree>,
    ) -> Result<SlashCommandOutput> {
        let argument = command.argument.unwrap_or_default();
        
        let text = match command.name.as_str() {
            "aios-debate" => self.start_debate(&argument, "")?,
            "aios-architect" => self.start_architect(&argument)?,
            "aios-analytics" => self.get_analytics()?,
            "aios-templates" => self.get_templates()?,
            _ => return Err(format!("Unknown command: {}", command.name)),
        };

        Ok(SlashCommandOutput {
            sections: vec![SlashCommandOutputSection {
                range: 0..text.len(),
                label: command.name.clone(),
            }],
            text,
        })
    }
}

zed::register_extension!(AiosExtension);

mod chrono_lite {
    pub struct Utc;
    impl Utc {
        pub fn now() -> Self { Self }
        pub fn timestamp_millis(&self) -> u64 {
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0)
        }
    }
}
