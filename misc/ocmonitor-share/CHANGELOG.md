# Changelog

All notable changes to OpenCode Monitor will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-XX

### 🎉 Initial Release

#### Added
- **Core CLI Application** - Complete command-line interface with Click framework
- **Rich Terminal UI** - Beautiful tables, progress bars, and colored output
- **Comprehensive Analytics** - Daily, weekly, monthly, and model-based breakdowns
- **Real-time Monitoring** - Live dashboard for active session monitoring
- **Data Export** - CSV and JSON export functionality with metadata
- **Multi-model Support** - Support for 6 AI models including Claude, Grok, Qwen, and Z-AI
- **Professional Documentation** - Complete setup guides and user documentation

#### Features
- 📊 **Session Analysis** - Analyze individual or batch sessions
- 💰 **Cost Tracking** - Accurate cost calculations with model-specific pricing
- 📈 **Usage Analytics** - Token usage, context utilization, and performance metrics
- 🎨 **Rich UI Components** - Color-coded tables with progress indicators
- ⚙️ **TOML Configuration** - User-friendly configuration management
- 🔄 **Live Dashboard** - Real-time session monitoring with auto-refresh
- 📤 **Export Capabilities** - Professional CSV and JSON exports

#### Supported Commands
```bash
ocmonitor config show      # Display configuration
ocmonitor session <path>   # Analyze single session
ocmonitor sessions <path>  # Analyze all sessions  
ocmonitor daily <path>     # Daily usage breakdown
ocmonitor weekly <path>    # Weekly usage breakdown
ocmonitor monthly <path>   # Monthly usage breakdown
ocmonitor models <path>    # Model usage analytics
ocmonitor live <path>      # Real-time monitoring
ocmonitor export <type>    # Data export functionality
```

#### Supported AI Models
- **Claude Sonnet 4** (2025-05-14) - $3/$15 per 1M tokens, 200k context
- **Claude Opus 4** - $15/$75 per 1M tokens, 200k context  
- **Claude Opus 4.1** - $15/$75 per 1M tokens, 200k context
- **Grok Code** - FREE, 256k context
- **Qwen3 Coder** (qwen/qwen3-coder) - FREE, 256k context
- **Z-AI GLM 4.5 Air** (z-ai/glm-4.5-air) - FREE, 128k context

#### Technical Improvements
- **Modular Architecture** - Clean separation of concerns with services, models, and UI
- **Error Handling** - Comprehensive error handling with user-friendly messages
- **Type Safety** - Full type hints and Pydantic models for data validation
- **Performance** - Memory-efficient processing of large session datasets
- **Extensibility** - Easy addition of new models and features

### 🛠️ Development Infrastructure

#### Added
- **Automated Installation** - `install.sh` script for easy setup
- **Comprehensive Testing** - Manual test suites and validation scripts
- **Documentation** - README, Quick Start, Manual Test Guide
- **Configuration Management** - TOML config with JSON model pricing
- **PATH Management** - Automatic PATH configuration handling

### 🐛 Bug Fixes

#### Fixed
- **JSON Serialization** - Fixed Decimal serialization for JSON exports
- **Model Name Parsing** - Proper handling of fully qualified model names (e.g., `qwen/qwen3-coder`)
- **Zero-token Filtering** - Filtered out empty interactions that caused confusion
- **Export Data Structure** - Fixed CLI export command data structure issues
- **Import Path Resolution** - Resolved Python module path issues
- **Installation Issues** - Created comprehensive installation guides and PATH configuration

### 📚 Documentation

#### Added
- **README.md** - Complete project overview and usage instructions
- **QUICK_START.md** - Fast setup and common usage patterns
- **MANUAL_TEST_GUIDE.md** - Comprehensive testing procedures
- **PROJECT_SUMMARY.md** - Detailed project documentation and achievements
- **Installation Guides** - Multiple installation methods with troubleshooting

### 🧪 Testing

#### Added
- **Basic Functionality Tests** - Core feature validation
- **Import Validation** - Module import and dependency checks
- **CLI Command Tests** - All command-line interfaces tested
- **Real Data Testing** - Validation with actual OpenCode session data
- **Error Scenario Testing** - Edge case and error handling validation

---

## Version History Summary

- **v1.0.0** - Initial production release with complete feature set
- **Pre-release** - Development phases transforming basic scripts into professional CLI tool

## Migration from Legacy Scripts

This release replaces the original three Python scripts:
- `session_summarizer.py` → `ocmonitor sessions`
- `token_summarizer.py` → `ocmonitor models` 
- `live_dashboard.py` → `ocmonitor live`

The new unified CLI provides all original functionality plus significant enhancements:
- Beautiful Rich terminal interface
- Comprehensive analytics and breakdowns
- Professional export capabilities  
- Real-time monitoring dashboard
- Robust error handling and validation
- Easy installation and configuration

---

*For detailed information about each feature, see the [README.md](README.md) and [documentation](QUICK_START.md).*