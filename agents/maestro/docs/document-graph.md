---
title: Document Graph
description: Visualize markdown file relationships and wiki-link connections in an interactive graph view.
icon: diagram-project
---

The Document Graph provides an interactive visualization of your markdown files and their connections. See how documents link to each other through wiki-links (`[[link]]`) and standard markdown links, making it easy to understand your documentation structure at a glance.

![Document Graph](./screenshots/document-graph.png)

## Opening the Document Graph

There are several ways to access the Document Graph:

### From the File Explorer

Click the **graph icon** (circular arrows) in the Files tab header to open the Document Graph for your current project.

![Last Graph Button](./screenshots/document-graph-last-graph.png)

### From Quick Actions

Press `Cmd+K` / `Ctrl+K` and search for "Document Graph" to open it directly.

### From File Preview

When viewing a markdown file in File Preview, press `Cmd+Shift+G` / `Ctrl+Shift+G` to open the Document Graph focused on that file. Press `Esc` to return to the File Preview.

### Using Go to File

Press `Cmd+G` / `Ctrl+G` to open the fuzzy file finder, navigate to any markdown file, then use `Cmd+Shift+G` to jump to the Document Graph from there.

## Navigating the Graph

The Document Graph is designed for keyboard-first navigation:

| Action | Key |
|--------|-----|
| Navigate to connected nodes | `Arrow Keys` (spatial detection) |
| Focus/select a node | `Enter` |
| Open the selected document | `O` |
| Close the graph | `Esc` |
| Cycle through connected nodes | `Tab` |

### Mouse Controls

- **Click** a node to select it
- **Double-click** a node to recenter the view on it
- **Drag** nodes to reposition them — positions are saved
- **Scroll** to zoom in and out
- **Pan** by dragging the background

## Graph Controls

The toolbar at the top of the Document Graph provides several options:

### Depth Control

Adjust the **Depth** setting to control how many levels of connections are shown from the focused document:

- **Depth: 1** — Show only direct connections
- **Depth: 2** — Show connections and their connections (default)
- **Depth: 3+** — Show deeper relationship chains

Lower depth values keep the graph focused; higher values reveal the full document ecosystem.

### External Links

Toggle **External** to show or hide external URL links found in your documents:

- **Enabled** — External links appear as separate domain nodes (e.g., "github.com", "docs.example.com")
- **Disabled** — Only internal document relationships are shown

External link nodes help you see which external resources your documentation references.

### Search

Use the search box to filter documents by name. Matching documents are highlighted in the graph.

## Understanding the Graph

### Node Types

- **Document nodes** — Your markdown files, showing the filename and a preview of content
- **External link nodes** — Domains of external URLs referenced in your documents
- **Focused node** — The currently selected document (highlighted with a different border)

### Edge Types

Lines between nodes represent different types of connections:

- **Wiki-links** — `[[document-name]]` style links
- **Markdown links** — `[text](path/to/file.md)` style links
- **External links** — Links to URLs outside your project

### Node Information

Each document node displays:

- **Filename** — The document name
- **Folder indicator** — Shows the parent directory (e.g., "docs")
- **Content preview** — A snippet of the document's content

## Tips for Effective Use

### Workflow Integration

1. Use `Cmd+G` to quickly find a file
2. Open it in File Preview to read or edit
3. Press `Cmd+Shift+G` to see its connections in the Document Graph
4. Press `O` to open a connected document
5. Press `Esc` to return to File Preview

### Large Documentation Sets

For projects with many markdown files:

- Start with **Depth: 1** to see immediate connections
- Increase depth gradually to explore relationships
- Use **Search** to find specific documents quickly
- Drag nodes to organize the view — positions persist

### Understanding Documentation Structure

The Document Graph is especially useful for:

- **Auditing links** — Find orphaned documents with no incoming links
- **Understanding navigation** — See how documents connect for readers
- **Planning restructuring** — Visualize the impact of moving or renaming files
- **Onboarding** — Help new team members understand documentation architecture

## Keyboard Shortcut Summary

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| Open Document Graph | Via `Cmd+K` menu | Via `Ctrl+K` menu |
| Open from File Preview | `Cmd+Shift+G` | `Ctrl+Shift+G` |
| Go to File (fuzzy finder) | `Cmd+G` | `Ctrl+G` |
| Navigate nodes | `Arrow Keys` | `Arrow Keys` |
| Select/focus node | `Enter` | `Enter` |
| Open document | `O` | `O` |
| Cycle connected nodes | `Tab` | `Tab` |
| Close graph | `Esc` | `Esc` |
