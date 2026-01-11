# Neon Theme Plugin

A cyberpunk-inspired neon color scheme for SuperAI CLI.

## Overview

This theme provides vibrant neon colors reminiscent of cyberpunk aesthetics:

| Color | Hex | Use |
|-------|-----|-----|
| Primary | `#FF00FF` | Main UI elements (magenta) |
| Secondary | `#00FFFF` | Secondary elements (cyan) |
| Background | `#0D0D0D` | Dark background |
| Foreground | `#E0E0E0` | Text color |
| Accent | `#FF1493` | Highlights (deep pink) |
| Error | `#FF0040` | Error messages |
| Warning | `#FFD700` | Warnings (gold) |
| Success | `#00FF00` | Success messages (lime) |

## Building

```bash
go build -buildmode=plugin -o neon-theme.so ./examples/plugins/neon-theme/
```

## Installation

```bash
cp neon-theme.so ~/.superai/plugins/
```

## Creating Custom Themes

1. Create a theme plugin using `BaseThemePlugin`:

```go
plugin.NewBaseThemePlugin(
    plugin.PluginInfo{
        Name: "my-theme",
        // ...
    },
    plugin.ThemeColors{
        Primary:    "#HEX",
        Secondary:  "#HEX",
        Background: "#HEX",
        Foreground: "#HEX",
        Accent:     "#HEX",
        Error:      "#HEX",
        Warning:    "#HEX",
        Success:    "#HEX",
    },
)
```

2. Optionally override `Apply()` for custom application logic.

## Color Palette Ideas

### Dracula
```go
Primary:    "#BD93F9"
Secondary:  "#8BE9FD"
Background: "#282A36"
Foreground: "#F8F8F2"
```

### Solarized Dark
```go
Primary:    "#268BD2"
Secondary:  "#2AA198"
Background: "#002B36"
Foreground: "#839496"
```

### Monokai
```go
Primary:    "#F92672"
Secondary:  "#66D9EF"
Background: "#272822"
Foreground: "#F8F8F2"
```

## License

MIT - Part of SuperAI CLI
