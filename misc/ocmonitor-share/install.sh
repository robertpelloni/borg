#!/bin/bash

# OpenCode Monitor Installation Script
# This script automates the installation process for OpenCode Monitor

set -e  # Exit on any error

echo "🚀 OpenCode Monitor Installation Script"
echo "======================================"

# Check if we're in the right directory
if [ ! -f "setup.py" ] || [ ! -d "ocmonitor" ]; then
    echo "❌ Error: Please run this script from the ocmonitor root directory"
    echo "   The directory should contain setup.py and ocmonitor/ folder"
    exit 1
fi

echo "✅ Found ocmonitor project directory"

# Check Python version
PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
if [[ "$(printf '%s\n' "3.7" "$PYTHON_VERSION" | sort -V | head -n1)" == "3.7" ]]; then
    echo "✅ Python version $PYTHON_VERSION is supported"
else
    echo "❌ Python 3.7 or higher is required"
    exit 1
fi

# Install dependencies
echo "📥 Installing dependencies..."
python3 -m pip install -r requirements.txt

# Install package in development mode
echo "🔧 Installing ocmonitor in development mode..."
python3 -m pip install -e .

# Get the scripts directory and add to PATH instructions
SCRIPTS_DIR=$(python3 -m site --user-base)/bin
echo "📁 Python scripts will be installed to: $SCRIPTS_DIR"

# Check if scripts directory is in PATH
if [[ ":$PATH:" != *":$SCRIPTS_DIR:"* ]]; then
    echo ""
    echo "⚠️  Warning: $SCRIPTS_DIR is not in your PATH"
    echo ""
    echo "📝 To fix this, add the following line to your shell configuration file:"
    echo ""
    echo "   For bash (~/.bashrc):"
    echo "   echo 'export PATH=\"$SCRIPTS_DIR:\$PATH\"' >> ~/.bashrc && source ~/.bashrc"
    echo ""
    echo "   For zsh (~/.zshrc):"
    echo "   echo 'export PATH=\"$SCRIPTS_DIR:\$PATH\"' >> ~/.zshrc && source ~/.zshrc"
    echo ""
    echo "   Then restart your terminal or run: source ~/.bashrc (or ~/.zshrc)"
    echo ""
else
    echo "✅ $SCRIPTS_DIR is already in your PATH"
fi

# Test installation
echo "🧪 Testing installation..."
if command -v ocmonitor &> /dev/null; then
    echo "✅ ocmonitor command is available"
    ocmonitor --version
else
    echo "⚠️  ocmonitor command not found in PATH"
    echo "   You can run it directly with:"
    echo "   $SCRIPTS_DIR/ocmonitor --help"
fi

echo ""
echo "🎉 Installation complete!"
echo ""
echo "📝 Next steps:"
echo "1. Add $SCRIPTS_DIR to your PATH if you haven't already (see instructions above)"
echo "2. Run 'ocmonitor --help' to see available commands"
echo "3. Run 'ocmonitor config show' to view current configuration"
echo ""
echo "For more detailed usage instructions, see MANUAL_TEST_GUIDE.md"