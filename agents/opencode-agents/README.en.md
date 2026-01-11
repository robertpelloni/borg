<p align="center">
  <a href="README.md">🇷🇺 Русский</a> · <a href="README.en.md">🇬🇧 English</a> · <a href="README.zh.md">🇨🇳 中文</a>
</p>

# OpenCode Agents

All models were written and tested with GLM4.6/GLM4.7 in mind, especially the Coding Plan subscription without token limits.

<p align="center">
  <img src="https://raw.githubusercontent.com/veschin/opencode-agents/refs/heads/main/logo.svg" width="512" alt="OpenCode Agents Logo">
</p>

<p align="center">
  <em>"A repository with .md files... but each file is a neurodivergent."</em>
</p>

---

## Installation

**Linux/macOS:**

```bash
# Create the agents directory
mkdir -p ~/.config/opencode/agent/

# Download only agent files via GitHub API
curl -s "https://api.github.com/repos/veschin/opencode-agents/contents" | \
  jq -r '.[] | select(.name | startswith("_") and endswith(".md")) | "\(.name)\t\(.download_url)"' | \
  while IFS=$'\t' read -r name url; do curl -s "$url" -o ~/.config/opencode/agent/"$name"; done
```

*Requires jq for JSON processing. Install via `sudo apt install jq` (Ubuntu/Debian), `brew install jq` (macOS), or `pacman -S jq` (Arch).*

**Windows (PowerShell):**

```powershell
# Create the agents directory
$agentDir = Join-Path $env:USERPROFILE ".config\opencode\agent"
if (-not (Test-Path $agentDir)) {
    New-Item -ItemType Directory -Path $agentDir -Force | Out-Null
}

# Download only agent files via GitHub API
$response = Invoke-RestMethod -Uri "https://api.github.com/repos/veschin/opencode-agents/contents"
$response | Where-Object { $_.name -like '_*.md' } | ForEach-Object {
    $content = Invoke-RestMethod -Uri $_.download_url
    $path = Join-Path $agentDir $_.name
    $content | Out-File -FilePath $path -Encoding UTF8
    Write-Host "Downloading $($_.name)..."
}
```

## _arch — Senior Solution Architect

A senior architect who views every task as a set of questions. Doesn't give deadlines, assesses complexity across four frameworks, and slices projects into phases with zero downtime.

Approaches any task through the **Bare Minimum Filter**: every project element is checked for criticality. If something isn't vital for the MVP, it doesn't make it to the first phase. If it can be done later, it gets done later. If it doesn't require an architectural solution now, it gets deferred.

Splits projects into T-shirt sizes: from XS (simple CRUD with validation) to XL (full domain redesign with scalability requirements). For each size—its own depth of work, its own Use Case Points, its own environmental factors.

When the project is broken into phases, it outputs JIRA tasks in a clear format: priority, story points, rollback strategy, zero downtime, monitoring metrics. Deployment isn't just "deploy," but a choice from six strategies: feature flags, canary rollout, blue-green, shadow mode, strangler pattern, or dark launch.

## _beagle — Virtual Hunting Dog Researcher

Receives a query and follows information trails: uncovers related topics, finds synonyms, dives into adjacent areas. Gradually expands the search scope, where each newly discovered fact leads to the next query.

Works quietly. Doesn't show intermediate reports, doesn't announce progress. Every statement is backed by a source in the format `[N]`.

Internally decodes queries into expert language, then branches the search: finds definitions, applications, technology comparisons. After building a map of connections between terms, it verifies facts across different sources and assembles the complete picture.

Delivers three things. Main conclusion—a brief answer to the query with recommendations. Connection map—a tree where terms lead to concepts, concepts to technologies, technologies to applications. And confidence assessment: High, Medium, or Low. Responds in the language of the query. All internal processing happens in English.

## _writer — Maximally Creative Agent

A writer with a narrative system. Before writing each sentence, goes through six phases of thinking, defining why the text exists, what path the reader will take, where questions will arise, and where the insight will strike.

Output is always in the language of the query, thinking is in English. The result reads as if written by a thoughtful person.
