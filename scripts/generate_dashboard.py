import subprocess
import os
import datetime

def get_submodule_status():
    result = subprocess.run(['git', 'submodule', 'status'], capture_output=True, text=True)
    submodules = []
    for line in result.stdout.splitlines():
        parts = line.strip().split()
        if len(parts) >= 2:
            commit = parts[0]
            path = parts[1]
            version = parts[2] if len(parts) > 2 else "unknown"
            submodules.append({'commit': commit, 'path': path, 'version': version})
    return submodules

def generate_dashboard(submodules):
    date_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    content = f"""# Submodule Dashboard

**Last Updated:** {date_str}

This document tracks the status, location, and version of all submodules and reference repositories in the AIOS project.

## Core Submodules (`submodules/`)

| Name | Path | Version | Commit |
|------|------|---------|--------|
"""
    
    core_submodules = [s for s in submodules if s['path'].startswith('submodules/')]
    for s in core_submodules:
        name = os.path.basename(s['path'])
        content += f"| **{name}** | `{s['path']}` | {s['version']} | `{s['commit'][:7]}` |\n"

    content += """
## Reference Repositories (`references/`)

These are cloned repositories used for research, pattern extraction, and feature porting.

| Name | Path | Version | Commit |
|------|------|---------|--------|
"""
    
    ref_submodules = [s for s in submodules if s['path'].startswith('references/')]
    for s in ref_submodules:
        name = os.path.basename(s['path'])
        content += f"| **{name}** | `{s['path']}` | {s['version']} | `{s['commit'][:7]}` |\n"

    content += """
## Project Structure Explanation

```
AIOS/
├── packages/
│   ├── core/       # The Node.js/Fastify Hub (Backend)
│   ├── ui/         # The Next.js Dashboard (Frontend)
│   ├── cli/        # The 'aios' command line tool
│   └── types/      # Shared TypeScript definitions
├── submodules/     # Integrated components (Git Submodules)
├── references/     # Research material (Git Submodules/Clones)
├── docs/           # Documentation & Strategy
├── scripts/        # Utility scripts
└── mcp-servers/    # Local MCP servers managed by the Hub
```
"""
    return content

if __name__ == "__main__":
    submodules = get_submodule_status()
    dashboard_content = generate_dashboard(submodules)
    with open('docs/SUBMODULE_DASHBOARD.md', 'w', encoding='utf-8') as f:
        f.write(dashboard_content)
    print("Dashboard updated.")
