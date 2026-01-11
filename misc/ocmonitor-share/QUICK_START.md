# 🚀 Quick Start Guide

Get up and running with OpenCode Monitor in just a few minutes!

## 📋 Prerequisites

- Python 3.7 or higher
- pip package manager
- OpenCode session data (stored in `~/.local/share/opencode/storage/message/`)

## 🛠️ Installation

### Option 1: Automated Installation (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd ocmonitor

# Run the installation script
./install.sh
```

### Option 2: Manual Installation

```bash
# Clone the repository
git clone <repository-url>
cd ocmonitor

# Install dependencies
python3 -m pip install -r requirements.txt

# Install the package
python3 -m pip install -e .

# Add to PATH (if needed)
echo 'export PATH="$(python3 -m site --user-base)/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

## 🎯 First Steps

### 1. Check Configuration
```bash
ocmonitor config show
```

### 2. Analyze Your Sessions
```bash
# Analyze all sessions (uses default OpenCode directory)
ocmonitor sessions

# Analyze a specific session
ocmonitor session /path/to/specific/session
```

### 3. View Different Reports
```bash
# Daily usage breakdown
ocmonitor daily

# Model usage analytics
ocmonitor models

# Weekly breakdown
ocmonitor weekly
```

### 4. Export Data
```bash
# Export to CSV
ocmonitor export sessions --format csv --output my_report.csv

# Export to JSON
ocmonitor export sessions --format json --output my_report.json
```

### 5. Real-time Monitoring
```bash
# Start live dashboard
ocmonitor live
```

## 📖 Common Commands

| Command | Description |
|---------|-------------|
| `ocmonitor --help` | Show all available commands |
| `ocmonitor config show` | Display current configuration |
| `ocmonitor sessions` | Analyze all sessions |
| `ocmonitor session <path>` | Analyze a single session |
| `ocmonitor daily` | Daily usage breakdown |
| `ocmonitor models` | Model usage analytics |
| `ocmonitor live` | Real-time monitoring dashboard |
| `ocmonitor export <type> --format <csv/json>` | Export data |

## 🎨 Output Formats

All commands support different output formats:

```bash
# Rich tables (default)
ocmonitor sessions

# JSON output
ocmonitor sessions --format json

# Export to files
ocmonitor export sessions --format csv --output report.csv
```

## 🤔 Need Help?

- Run `ocmonitor <command> --help` for specific command help
- Check `MANUAL_TEST_GUIDE.md` for comprehensive usage examples
- File an issue on GitHub if you encounter problems

## 🎉 You're Ready!

Start exploring your OpenCode session data and gain insights into your AI-assisted coding patterns!