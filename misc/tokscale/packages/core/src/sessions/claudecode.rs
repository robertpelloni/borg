//! Claude Code session parser
//!
//! Parses JSONL files from ~/.claude/projects/

use super::UnifiedMessage;
use crate::TokenBreakdown;
use serde::Deserialize;
use std::collections::HashSet;
use std::io::{BufRead, BufReader};
use std::path::Path;

/// Claude Code entry structure (from JSONL files)
#[derive(Debug, Deserialize)]
pub struct ClaudeEntry {
    #[serde(rename = "type")]
    pub entry_type: String,
    pub timestamp: Option<String>,
    pub message: Option<ClaudeMessage>,
    /// Request ID for deduplication (used with message.id)
    #[serde(rename = "requestId")]
    pub request_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ClaudeMessage {
    pub model: Option<String>,
    pub usage: Option<ClaudeUsage>,
    /// Message ID for deduplication (used with requestId)
    pub id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ClaudeUsage {
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub cache_read_input_tokens: Option<i64>,
    pub cache_creation_input_tokens: Option<i64>,
}

/// Parse a Claude Code JSONL file
pub fn parse_claude_file(path: &Path) -> Vec<UnifiedMessage> {
    let file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return Vec::new(),
    };

    let session_id = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string();

    let reader = BufReader::new(file);
    let mut messages = Vec::new();
    let mut processed_hashes: HashSet<String> = HashSet::new();

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => continue,
        };

        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let mut bytes = trimmed.as_bytes().to_vec();
        let entry: ClaudeEntry = match simd_json::from_slice(&mut bytes) {
            Ok(e) => e,
            Err(_) => continue,
        };

        // Only process assistant messages with usage data
        if entry.entry_type != "assistant" {
            continue;
        }

        let message = match entry.message {
            Some(m) => m,
            None => continue,
        };

        // Build dedup key for global deduplication (messageId:requestId composite)
        let dedup_key = match (&message.id, &entry.request_id) {
            (Some(msg_id), Some(req_id)) => {
                let hash = format!("{}:{}", msg_id, req_id);
                if !processed_hashes.insert(hash.clone()) {
                    continue;
                }
                Some(hash)
            }
            _ => None,
        };

        let usage = match message.usage {
            Some(u) => u,
            None => continue,
        };

        let model = match message.model {
            Some(m) => m,
            None => continue,
        };

        let timestamp = entry
            .timestamp
            .and_then(|ts| chrono::DateTime::parse_from_rfc3339(&ts).ok())
            .map(|dt| dt.timestamp_millis())
            .unwrap_or(0);

        if timestamp == 0 {
            continue;
        }

        messages.push(UnifiedMessage::new_with_dedup(
            "claude",
            model,
            "anthropic",
            session_id.clone(),
            timestamp,
            TokenBreakdown {
                input: usage.input_tokens.unwrap_or(0),
                output: usage.output_tokens.unwrap_or(0),
                cache_read: usage.cache_read_input_tokens.unwrap_or(0),
                cache_write: usage.cache_creation_input_tokens.unwrap_or(0),
                reasoning: 0,
            },
            0.0,
            dedup_key,
        ));
    }

    messages
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    fn create_test_file(content: &str) -> NamedTempFile {
        let mut file = NamedTempFile::new().unwrap();
        file.write_all(content.as_bytes()).unwrap();
        file.flush().unwrap();
        file
    }

    #[test]
    fn test_deduplication_skips_duplicate_entries() {
        let content = r#"{"type":"assistant","timestamp":"2024-12-01T10:00:00.000Z","requestId":"req_001","message":{"id":"msg_001","model":"claude-3-5-sonnet","usage":{"input_tokens":100,"output_tokens":50}}}
{"type":"assistant","timestamp":"2024-12-01T10:00:01.000Z","requestId":"req_001","message":{"id":"msg_001","model":"claude-3-5-sonnet","usage":{"input_tokens":100,"output_tokens":50}}}
{"type":"assistant","timestamp":"2024-12-01T10:00:02.000Z","requestId":"req_002","message":{"id":"msg_002","model":"claude-3-5-sonnet","usage":{"input_tokens":200,"output_tokens":100}}}"#;

        let file = create_test_file(content);
        let messages = parse_claude_file(file.path());

        assert_eq!(messages.len(), 2, "Should deduplicate to 2 messages (first duplicate skipped)");
        assert_eq!(messages[0].tokens.input, 100);
        assert_eq!(messages[1].tokens.input, 200);
    }

    #[test]
    fn test_deduplication_allows_same_message_different_request() {
        let content = r#"{"type":"assistant","timestamp":"2024-12-01T10:00:00.000Z","requestId":"req_001","message":{"id":"msg_001","model":"claude-3-5-sonnet","usage":{"input_tokens":100,"output_tokens":50}}}
{"type":"assistant","timestamp":"2024-12-01T10:00:01.000Z","requestId":"req_002","message":{"id":"msg_001","model":"claude-3-5-sonnet","usage":{"input_tokens":150,"output_tokens":75}}}"#;

        let file = create_test_file(content);
        let messages = parse_claude_file(file.path());

        assert_eq!(messages.len(), 2, "Different requestId should not be deduplicated");
    }

    #[test]
    fn test_entries_without_dedup_fields_still_processed() {
        let content = r#"{"type":"assistant","timestamp":"2024-12-01T10:00:00.000Z","message":{"model":"claude-3-5-sonnet","usage":{"input_tokens":100,"output_tokens":50}}}
{"type":"assistant","timestamp":"2024-12-01T10:00:01.000Z","message":{"model":"claude-3-5-sonnet","usage":{"input_tokens":200,"output_tokens":100}}}"#;

        let file = create_test_file(content);
        let messages = parse_claude_file(file.path());

        assert_eq!(messages.len(), 2, "Entries without messageId/requestId should still be processed");
    }

    #[test]
    fn test_user_messages_ignored() {
        let content = r#"{"type":"user","timestamp":"2024-12-01T10:00:00.000Z","message":{"content":"Hello"}}
{"type":"assistant","timestamp":"2024-12-01T10:00:01.000Z","requestId":"req_001","message":{"id":"msg_001","model":"claude-3-5-sonnet","usage":{"input_tokens":100,"output_tokens":50}}}"#;

        let file = create_test_file(content);
        let messages = parse_claude_file(file.path());

        assert_eq!(messages.len(), 1, "User messages should be ignored");
        assert_eq!(messages[0].tokens.input, 100);
    }

    #[test]
    fn test_token_breakdown_parsing() {
        let content = r#"{"type":"assistant","timestamp":"2024-12-01T10:00:00.000Z","requestId":"req_001","message":{"id":"msg_001","model":"claude-3-5-sonnet","usage":{"input_tokens":1000,"output_tokens":500,"cache_read_input_tokens":200,"cache_creation_input_tokens":100}}}"#;

        let file = create_test_file(content);
        let messages = parse_claude_file(file.path());

        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].tokens.input, 1000);
        assert_eq!(messages[0].tokens.output, 500);
        assert_eq!(messages[0].tokens.cache_read, 200);
        assert_eq!(messages[0].tokens.cache_write, 100);
        assert_eq!(messages[0].tokens.reasoning, 0);
    }
}
