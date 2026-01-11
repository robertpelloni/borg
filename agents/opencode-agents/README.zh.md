<p align="center">
  <a href="README.md">🇷🇺 Русский</a> · <a href="README.en.md">🇬🇧 English</a> · <a href="README.zh.md">🇨🇳 中文</a>
</p>

# OpenCode Agents

所有模型均基于 GLM4.6/GLM4.7 编写和测试，特别是无令牌限制的 Coding Plan 订阅。

<p align="center">
  <img src="https://raw.githubusercontent.com/veschin/opencode-agents/refs/heads/main/logo.svg" width="512" alt="OpenCode Agents Logo">
</p>

<p align="center">
  <em>"一个包含 .md 文件的仓库……但每个文件都是一个神经多元者。"</em>
</p>

---

## 安装

**Linux/macOS:**

```bash
# 创建代理目录
mkdir -p ~/.config/opencode/agent/

# 通过 GitHub API 仅下载代理文件
curl -s "https://api.github.com/repos/veschin/opencode-agents/contents" | \
  jq -r '.[] | select(.name | startswith("_") and endswith(".md")) | "\(.name)\t\(.download_url)"' | \
  while IFS=$'\t' read -r name url; do curl -s "$url" -o ~/.config/opencode/agent/"$name"; done
```

*需要 jq 来处理 JSON。通过 `sudo apt install jq`（Ubuntu/Debian）、`brew install jq`（macOS）或 `pacman -S jq`（Arch）安装。*

**Windows (PowerShell):**

```powershell
# 创建代理目录
$agentDir = Join-Path $env:USERPROFILE ".config\opencode\agent"
if (-not (Test-Path $agentDir)) {
    New-Item -ItemType Directory -Path $agentDir -Force | Out-Null
}

# 通过 GitHub API 仅下载代理文件
$response = Invoke-RestMethod -Uri "https://api.github.com/repos/veschin/opencode-agents/contents"
$response | Where-Object { $_.name -like '_*.md' } | ForEach-Object {
    $content = Invoke-RestMethod -Uri $_.download_url
    $path = Join-Path $agentDir $_.name
    $content | Out-File -FilePath $path -Encoding UTF8
    Write-Host "Downloading $($_.name)..."
}
```

## _arch — 高级解决方案架构师

一位高级架构师，将每个任务视为一系列问题。不给出期限，通过四个框架评估复杂性，并将项目分解为零停机时间的阶段。

通过 **极简过滤器** 接触任何任务：检查每个项目元素的关键性。如果某些内容对 MVP 不至关重要，就不会进入第一阶段。如果可以稍后完成，就稍后完成。如果现在不需要架构解决方案，就推迟执行。

按 T 恤尺码拆分项目：从 XS（带验证的简单 CRUD）到 XL（具有可扩展性要求的完整领域重新设计）。每个尺寸都有自己的工作深度、自己的用例点、自己的环境因素。

当项目分解为阶段后，以清晰的格式输出 JIRA 任务：优先级、故事点、回滚策略、零停机时间、监控指标。部署不仅仅是"部署"，而是从六种策略中选择：功能标志、金丝雀发布、蓝绿部署、影子模式、绞杀者模式或暗发布。

## _beagle — 虚拟猎犬研究员

接收查询并跟踪信息线索：揭示相关主题、发现同义词、深入相邻领域。逐步扩大搜索范围，每个新发现的事实都会引出下一个查询。

安静地工作。不显示中间报告，不宣布进度。每个陈述都必须以 `[N]` 格式注明来源。

在内部将查询解码为专家语言，然后分支搜索：查找定义、应用、技术比较。构建术语之间的连接地图后，通过不同来源验证事实并组装完整画面。

输出三样东西。主要结论——对查询的简要回答及建议。连接地图——一个树状结构，术语引向概念，概念引向技术，技术引向应用。以及置信度评估：高、中或低。始终用查询的语言回答。所有内部处理都用英语进行。

## _writer — 最大化创意代理

一个拥有叙事系统的作家。在写每句话之前，经过六个思考阶段，定义文本存在的原因、读者将经历什么路径、问题会在哪里出现、以及洞察会在哪里击中。

输出始终使用查询的语言，思考使用英语。结果读起来就像一个深思熟虑的人写的。
