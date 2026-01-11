#!/usr/bin/env python3
"""Wrapper script to run OpenCode Monitor CLI."""

import sys
import os
from pathlib import Path

# Ensure we're in the right directory and add to Python path
script_dir = Path(__file__).parent
os.chdir(script_dir)
sys.path.insert(0, str(script_dir))

try:
    from ocmonitor.cli import main
    main()
except ImportError as e:
    print(f"❌ Import error: {e}")
    print(f"Current directory: {os.getcwd()}")
    print(f"Python path: {sys.path[:3]}")
    print("\n🔧 Please ensure you're running from the correct directory:")
    print("cd /Users/shelli/Documents/apps/ocmonitor/ocmonitor")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error running OpenCode Monitor: {e}")
    sys.exit(1)