#!/bin/bash
# build-plugins.sh - Build all example plugins for SuperAI CLI
#
# Usage: ./scripts/build-plugins.sh [output-dir]
#
# This script builds all plugins in examples/plugins/ and outputs
# the compiled .so/.dll/.dylib files to the specified directory
# (default: ~/.superai/plugins/)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Determine output directory
OUTPUT_DIR="${1:-$HOME/.superai/plugins}"

# Determine file extension based on OS
case "$(uname -s)" in
    Linux*)     EXT=".so";;
    Darwin*)    EXT=".dylib";;
    MINGW*|CYGWIN*|MSYS*) EXT=".dll";;
    *)          EXT=".so";;
esac

echo -e "${YELLOW}SuperAI CLI Plugin Builder${NC}"
echo "================================"
echo "Output directory: $OUTPUT_DIR"
echo "Plugin extension: $EXT"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Find script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PLUGINS_DIR="$PROJECT_ROOT/examples/plugins"

# Check if plugins directory exists
if [ ! -d "$PLUGINS_DIR" ]; then
    echo -e "${RED}Error: Plugins directory not found: $PLUGINS_DIR${NC}"
    exit 1
fi

# Build each plugin
BUILT=0
FAILED=0

for plugin_dir in "$PLUGINS_DIR"/*/; do
    if [ -d "$plugin_dir" ]; then
        plugin_name=$(basename "$plugin_dir")
        main_file="$plugin_dir/main.go"
        
        if [ -f "$main_file" ]; then
            output_file="$OUTPUT_DIR/${plugin_name}${EXT}"
            
            echo -n "Building $plugin_name... "
            
            if go build -buildmode=plugin -o "$output_file" "$main_file" 2>/dev/null; then
                echo -e "${GREEN}OK${NC} -> $output_file"
                ((BUILT++))
            else
                echo -e "${RED}FAILED${NC}"
                ((FAILED++))
                
                # Show error details
                echo -e "${YELLOW}  Error details:${NC}"
                go build -buildmode=plugin -o "$output_file" "$main_file" 2>&1 | sed 's/^/    /'
            fi
        else
            echo -e "${YELLOW}Skipping $plugin_name (no main.go)${NC}"
        fi
    fi
done

echo ""
echo "================================"
echo -e "Built: ${GREEN}$BUILT${NC}, Failed: ${RED}$FAILED${NC}"

if [ $FAILED -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}Note: Plugin building requires Go with CGO enabled.${NC}"
    echo "Some platforms may not support -buildmode=plugin."
    exit 1
fi

echo ""
echo -e "${GREEN}Plugins installed to: $OUTPUT_DIR${NC}"
echo "Start SuperAI CLI and press 'p' to see your plugins."
