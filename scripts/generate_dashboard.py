import subprocess
import os
import datetime

def get_submodule_status():
    """Gets status of registered submodules."""
    try:
        result = subprocess.run(
            ["git", "submodule", "status", "--recursive"], capture_output=True, text=True, encoding="utf-8"
        )
        submodules = {}
        for line in result.stdout.splitlines():
            parts = line.strip().split()
            if len(parts) >= 2:
                # git submodule status output: [-/+]commit path [describe]
                commit = parts[0].lstrip("-+U")
                path = parts[1]
                version = parts[2] if len(parts) > 2 else "unknown"
                submodules[path] = {
                    "commit": commit,
                    "version": version,
                    "is_submodule": True,
                }
        return submodules
    except Exception as e:
        print(f"Error getting submodule status: {e}")
        return {}

def get_repo_description(repo_path):
    """Attempts to extract a description from README.md."""
    readme_names = ["README.md", "readme.md", "README.txt", "ReadMe.md", "README.rst"]
    for name in readme_names:
        try:
            full_path = os.path.join(repo_path, name)
            if os.path.exists(full_path):
                with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                    lines = f.readlines()
                    # Skip badges and headers
                    for line in lines[:20]:
                        line = line.strip()
                        if line and not line.startswith("#") and not line.startswith("[!") and len(line) > 10:
                            # Remove markdown links [text](url) -> text
                            # This is a naive regex
                            import re
                            line = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', line)
                            return line[:150] + "..." if len(line) > 150 else line
                    return "No description found in README."
        except Exception:
            continue
    return "No README found."

def generate_dashboard():
    date_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    registered = get_submodule_status()
    
    # Define category mappings based on directory prefixes
    category_map = {
        "mcp-servers": "MCP Servers",
        "mcp-hubs": "MCP Hubs & Registries",
        "mcp-dev-tools": "MCP Developer Tools",
        "mcp-routers": "MCP Routers & Proxies",
        "mcp-frameworks": "MCP Frameworks",
        "memory": "Memory Ecosystem",
        "superai-cli": "SuperAI CLI Ecosystem",
        "agents": "Autonomous Agents",
        "skills": "Skill Library",
        "tools": "Developer Tools",
        "cli-tools": "CLI Tools",
        "frameworks": "Frameworks",
        "computer-use": "Computer Use",
        "browser-use": "Browser Automation",
        "code-sandbox": "Code Sandboxing",
        "code-indexing": "Code Indexing",
        "RAG": "RAG Systems",
        "research": "Research",
        "submodules": "Core Submodules",
        "web-ui": "Web Interfaces",
        "config": "Configuration",
        "auth": "Authentication",
        "misc": "Miscellaneous"
    }

    dashboard_data = {}

    for path, info in registered.items():
        # Determine category
        parts = path.split("/")
        top_dir = parts[0]
        
        # Special handling for deeply nested categories if needed
        category = category_map.get(top_dir, "Other / Uncategorized")
        
        if category not in dashboard_data:
            dashboard_data[category] = []

        desc = get_repo_description(path)
        name = os.path.basename(path)
        
        # Try to find a cleaner name (e.g. from git config?) 
        # But folder name is usually good enough.

        dashboard_data[category].append({
            "name": name,
            "path": path,
            "version": info["version"],
            "commit": info["commit"],
            "description": desc
        })

    # Generate Markdown
    content = f"""# AIOS Ecosystem Dashboard

**Last Updated:** {date_str}
**Total Modules:** {len(registered)}

This dashboard tracks the status of all {len(registered)} integrated submodules and tools within the AIOS ecosystem.

"""

    # Order categories: Custom order for importance, then alphabetical
    priority_order = [
        "SuperAI CLI Ecosystem",
        "MCP Servers", 
        "MCP Hubs & Registries",
        "Autonomous Agents",
        "Memory Ecosystem",
        "Computer Use",
        "Browser Automation",
        "Code Sandboxing",
        "RAG Systems"
    ]
    
    # Get all keys, sort them
    all_cats = sorted(dashboard_data.keys())
    # Create final sorted list
    sorted_cats = [c for c in priority_order if c in all_cats] + [c for c in all_cats if c not in priority_order]

    for cat in sorted_cats:
        repos = dashboard_data[cat]
        if not repos:
            continue

        content += f"## {cat} ({len(repos)})\n\n"
        content += "| Name | Path | Version/Commit | Description |\n"
        content += "|------|------|----------------|-------------|\n"

        for repo in sorted(repos, key=lambda x: x["name"].lower()):
            commit_display = f"`{repo['commit'][:7]}`"
            if repo['version'] and repo['version'] != "unknown":
                commit_display += f" <br> *({repo['version']})*"
            
            # Clean description for table
            clean_desc = repo['description'].replace("|", "-").replace("\n", " ")
            
            content += f"| **{repo['name']}** | `{repo['path']}` | {commit_display} | {clean_desc} |\n"
        content += "\n"

    # Add directory structure explanation
    content += """## Project Structure Explanation

| Directory | Purpose |
|-----------|---------|
| **`superai-cli/`** | The consolidated CLI ecosystem. Contains `clis/` (wrappers), `tools/`, and `proxies/`. |
| **`mcp-servers/`** | General purpose Model Context Protocol servers organized by domain (browser, financial, etc.). |
| **`memory/`** | The comprehensive Memory Ecosystem. Includes `systems/` (LettA, Mem0), `vector-stores/`, and plugins. |
| **`agents/`** | Autonomous agent implementations and definitions. |
| **`skills/`** | Universal skill library for agents. |
| **`computer-use/`** | Desktop automation and GUI control tools. |
| **`browser-use/`** | Browser automation and web scraping tools. |
| **`RAG/`** | Retrieval Augmented Generation systems and parsers. |
| **`packages/`** | Core AIOS monorepo packages (`core`, `ui`, `cli`). |
"""

    return content

if __name__ == "__main__":
    try:
        content = generate_dashboard()
        # Write to root SUBMODULES.md
        with open("SUBMODULES.md", "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Dashboard updated at SUBMODULES.md")
    except Exception as e:
        print(f"Error generating dashboard: {e}")
