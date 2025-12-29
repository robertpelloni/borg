# Bin Directory - Utility Scripts

## cleanup.sh - Pipeline Cleanup Script

A comprehensive cleanup utility for the OpenCode documentation pipeline that removes all generated files while preserving source materials.

### Quick Usage

```bash
# Clean everything (default)
./bin/cleanup.sh

# Clean only specific areas
./bin/cleanup.sh --docs    # Clean generated PDFs and Word docs
./bin/cleanup.sh --python  # Clean generated Python scripts
./bin/cleanup.sh --temp    # Clean temporary and JSON files
./bin/cleanup.sh --help    # Show usage information
```

### What Gets Cleaned

#### With `--docs` or default:
- `docs/pdf/*` - All generated PDF files
- `docs/word/*` - All generated Word documents  
- `docs/markdown_mermaid/` - Intermediate markdown files
- `docs/markdown_mermaid_clean/` - Cleaned markdown files
- `docs/markdown_mermaid_fixed/` - Fixed markdown files
- `docs/markdown_final/` - Final processed markdown

#### With `--python` or default:
- `src/*.py` - All generated Python scripts
- `*.py` - Any Python files in root (shouldn't exist)

#### With `--temp` or default:
- `*.json` - All generated JSON manifest files
- `*.tmp`, `*.log`, `*.bak` - Temporary files
- `test.*` - Test output files

### What Gets Preserved

The cleanup script NEVER removes:
- `docs/markdown/` - Original source markdown files
- `.opencode/` - Agent configurations and prompts
- `AGENTS.md`, `CLAUDE.md` - Project documentation
- `bin/` - This directory and its scripts

### Directory Structure

After cleanup, the script ensures these directories exist:
- `docs/pdf/` - Ready for new PDF generation
- `docs/word/` - Ready for new Word generation
- `docs/markdown_mermaid/mermaid/` - Ready for mermaid extraction
- `docs/markdown_mermaid/images/` - Ready for image generation
- `src/` - Ready for new Python scripts

### Testing Workflow

Recommended workflow for testing agents:

```bash
# 1. Clean everything before testing
./bin/cleanup.sh

# 2. Run the pipeline
# Use: run @.opencode/agents/workflow-orchestrator.md

# 3. If something fails, clean and retry
./bin/cleanup.sh

# 4. For iterative testing, clean only what changed
./bin/cleanup.sh --docs  # If only testing document generation
```

### Exit Codes

- `0` - Successful cleanup
- `1` - Invalid command line option

### Color Output

The script uses colored output for clarity:
- 🟢 Green checkmarks (✓) - Successfully removed/cleaned
- 🟡 Yellow circles (○) - Skipped (file not found)
- 🔵 Blue headers - Section markers
- 🔷 Cyan boxes - Main headers and summary

### Integration with Agents

The cleanup script is designed to work with the OpenCode agent pipeline:
1. Agents generate files in specific locations
2. Cleanup removes all generated content
3. Directory structure is maintained for next run
4. Source files are always preserved

### Troubleshooting

If cleanup seems incomplete:
1. Check if new file types were generated
2. Update the script's file patterns if needed
3. Use `--all` to ensure complete cleanup
4. Check file permissions if removal fails

### Notes

- The script is idempotent - safe to run multiple times
- Uses `rm -rf` for directories - be careful with modifications
- Always preserves source materials and configurations
- Creates necessary directories after cleanup