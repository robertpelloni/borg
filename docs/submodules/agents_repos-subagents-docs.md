# Mermaid-to-PDF Documentation Pipeline

A sophisticated Claude Code agent orchestration system that converts markdown files with embedded Mermaid diagrams into professional PDF and Word documents with properly rendered diagram images.

## Overview

This pipeline automates the complex process of extracting Mermaid diagrams from markdown files, generating images from them, and producing publication-ready documents. It leverages Claude Code's subagent architecture to create a robust, maintainable workflow that handles everything from diagram extraction to final document generation.

## Features

- **Automated Mermaid Extraction**: Intelligently identifies and extracts all Mermaid code blocks from markdown files
- **Image Generation**: Converts Mermaid diagrams to high-quality PNG images using mermaid-cli
- **Document Conversion**: Generates both PDF and Word documents with embedded images
- **UTF-8 Handling**: Automatically sanitizes content when encoding issues occur
- **Workflow Orchestration**: Coordinated pipeline managed by specialized Claude Code agents
- **Comprehensive Logging**: Detailed logs for debugging and audit trails

## Prerequisites

### Required Tools

1. **Node.js and npm** (for Mermaid CLI)
2. **Mermaid CLI**:
   ```bash
   npm install -g @mermaid-js/mermaid-cli
   ```
3. **Pandoc** (for document conversion):
   - macOS: `brew install pandoc`
   - Ubuntu/Debian: `sudo apt-get install pandoc`
   - Windows: Download from [pandoc.org](https://pandoc.org/installing.html)
4. **XeLaTeX** (for PDF generation):
   - macOS: Install MacTeX or BasicTeX
   - Ubuntu/Debian: `sudo apt-get install texlive-xetex`
   - Windows: Install MiKTeX or TeX Live

### Verification

Verify installations:
```bash
mmdc --version      # Should show mermaid-cli version
pandoc --version    # Should show pandoc version
xelatex --version   # Should show XeLaTeX version
```

## Directory Structure

```
docs/
├── README.md                 # This file
├── markdown/                 # Source markdown files (input)
│   ├── article.md
│   ├── test-diagrams.md
│   └── ...
├── markdown_mermaid/         # Processed files
│   ├── images/              # Generated PNG diagrams
│   │   ├── article_01_mindmap.png
│   │   ├── article_02_flowchart.png
│   │   └── ...
│   ├── mermaid/             # Extracted .mmd files
│   │   ├── article_01_mindmap.mmd
│   │   ├── article_02_flowchart.mmd
│   │   └── ...
│   ├── article.md           # Modified markdown with image links
│   └── test-diagrams.md     # Modified markdown with image links
├── pdf/                     # PDF output documents
│   ├── article.pdf
│   └── test-diagrams.pdf
└── word/                    # Word output documents
    ├── article.docx
    └── test-diagrams.docx
```

## Usage

### Quick Start

1. Place your markdown files with Mermaid diagrams in `docs/markdown/`
2. Run the workflow orchestrator agent:
   ```bash
   # Using Claude Code
   # Ask Claude: "Run the workflow-orchestrator agent on docs/markdown/article.md"
   ```
3. Find your outputs in:
   - PDF: `docs/pdf/`
   - Word: `docs/word/`

### Manual Pipeline Execution

If you prefer to run the pipeline steps manually:

1. **Extract Mermaid diagrams**:
   ```bash
   python src/extract_mermaid.py
   ```

2. **Generate images from diagrams**:
   ```bash
   python src/generate_images.py
   ```

3. **Convert to PDF**:
   ```bash
   cd docs/markdown_mermaid
   pandoc article.md -o ../pdf/article.pdf --pdf-engine=xelatex --toc
   ```

4. **Convert to Word**:
   ```bash
   pandoc article.md -o ../word/article.docx --toc
   ```

## Claude Code Agents

This project uses seven specialized Claude Code subagents:

### 1. Workflow Orchestrator
- **Role**: Master coordinator
- **Location**: `.claude/agents/workflow-orchestrator.md`
- **Manages**: Entire pipeline from start to finish

### 2. Mermaid Extractor
- **Role**: Diagram extraction specialist
- **Location**: `.claude/agents/mermaid-extractor.md`
- **Function**: Scans markdown files and extracts Mermaid code blocks

### 3. Image Generator
- **Role**: Diagram rendering specialist
- **Location**: `.claude/agents/image-generator.md`
- **Function**: Converts .mmd files to PNG images using mermaid-cli

### 4. Markdown Rebuilder
- **Role**: Content transformation specialist
- **Location**: `.claude/agents/markdown-rebuilder.md`
- **Function**: Replaces Mermaid blocks with image references

### 5. Pandoc Converter
- **Role**: Document generation specialist
- **Location**: `.claude/agents/pandoc-converter.md`
- **Function**: Creates PDF and Word documents

### 6. UTF Sanitizer
- **Role**: Encoding issue handler
- **Location**: `.claude/agents/utf-sanitizer.md`
- **Function**: Creates ASCII-safe versions when UTF errors occur

### 7. File Organizer
- **Role**: Infrastructure manager
- **Location**: `.claude/agents/file-organizer.md`
- **Function**: Maintains directory structure and file organization

## File Naming Conventions

- **Extracted Mermaid files**: `<source_name>_NN_<type>.mmd`
  - `NN`: Two-digit sequence number (01, 02, ...)
  - `type`: Diagram type (flowchart, mindmap, class, sequence, etc.)
  - Example: `article_01_mindmap.mmd`

- **Generated images**: Same as .mmd files with .png extension
  - Example: `article_01_mindmap.png`

- **Sanitized markdown**: `<source_name>_PDF.md` (only created when UTF issues occur)

## Supported Mermaid Diagram Types

- Flowcharts
- Sequence Diagrams
- Class Diagrams
- State Diagrams
- Entity Relationship Diagrams
- Gantt Charts
- Pie Charts
- Git Graphs
- Journey Maps
- Quadrant Charts
- Mind Maps

## Troubleshooting

### Common Issues

1. **"mmdc not found" error**:
   - Ensure mermaid-cli is installed globally: `npm install -g @mermaid-js/mermaid-cli`
   - Check PATH includes npm global bin directory

2. **PDF generation fails**:
   - Verify XeLaTeX is installed
   - Check for UTF-8 encoding issues in source markdown
   - Review pandoc-pdf.log for detailed errors

3. **Images not appearing in documents**:
   - Ensure images are generated in `docs/markdown_mermaid/images/`
   - Verify image paths in modified markdown files
   - Check image file permissions

4. **UTF-8 encoding errors**:
   - The UTF sanitizer agent will automatically create ASCII-safe versions
   - Look for `*_PDF.md` files in the markdown_mermaid directory

### Logs

Detailed logs are created during processing:
- `logs/workflow_*.md`: Complete workflow execution logs
- `pandoc-*.log`: Pandoc conversion logs
- `*_manifest.json`: Extraction and generation manifests

## Example Output

### Input Markdown
```markdown
## System Architecture

\`\`\`mermaid
flowchart LR
    A[User] --> B[Web Server]
    B --> C[Database]
    B --> D[Cache]
\`\`\`
```

### Generated Files
1. `article_01_flowchart.mmd` - Extracted diagram
2. `article_01_flowchart.png` - Generated image
3. `article.md` - Modified with `![Diagram 1](images/article_01_flowchart.png)`
4. `article.pdf` - Final PDF with embedded diagram
5. `article.docx` - Final Word document with embedded diagram

## Performance

Typical processing times:
- Small document (5-10 diagrams): 2-3 minutes
- Medium document (10-20 diagrams): 5-7 minutes
- Large document (20+ diagrams): 8-12 minutes

File sizes:
- PNG images: 40-150KB per diagram
- PDF documents: 400-600KB (with embedded images)
- Word documents: 400-500KB (with embedded images)

## Contributing

To extend or modify the pipeline:

1. Agent modifications: Edit files in `.claude/agents/`
2. Python scripts: Modify files in `src/`
3. Test with sample documents in `docs/markdown/`

## License

This project is part of the Claude Code documentation agents collection.

## Support

For issues or questions:
- Review logs in `logs/` directory
- Check agent documentation in `.claude/agents/`
- Ensure all prerequisites are correctly installed

## Acknowledgments

Built with Claude Code's subagent orchestration system, leveraging:
- Mermaid.js for diagram rendering
- Pandoc for document conversion
- Claude AI for intelligent workflow management