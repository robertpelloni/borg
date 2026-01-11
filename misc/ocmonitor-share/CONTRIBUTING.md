# Contributing to OpenCode Monitor

Thank you for considering contributing to OpenCode Monitor! This document provides guidelines and information for contributors.

## 🚀 Quick Start for Contributors

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/yourusername/ocmonitor.git
   cd ocmonitor
   ```

2. **Set Up Development Environment**
   ```bash
   python3 -m pip install -r requirements.txt
   python3 -m pip install -e .
   ```

3. **Verify Installation**
   ```bash
   ocmonitor --help
   python3 test_basic.py
   ```

## 📋 Ways to Contribute

### 🐛 Bug Reports

When filing a bug report, please include:

- **Clear Description** - What happened vs. what you expected
- **Steps to Reproduce** - Detailed steps to recreate the issue
- **Environment Info** - OS, Python version, OpenCode Monitor version
- **Sample Data** - If possible, include sample session data (anonymized)
- **Error Messages** - Full error messages and stack traces

**Template:**
```markdown
**Bug Description**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Run command '...'
2. With data '...'
3. See error

**Expected Behavior**
What you expected to happen.

**Environment**
- OS: [e.g. macOS 12.0]
- Python Version: [e.g. 3.9.0]
- OpenCode Monitor Version: [e.g. 1.0.0]

**Additional Context**
Any other context about the problem.
```

### 💡 Feature Requests

For feature requests, please include:

- **Use Case** - Why would this feature be useful?
- **Proposed Solution** - How should it work?
- **Alternative Solutions** - Other ways to achieve the same goal
- **Implementation Ideas** - Technical approach (if you have ideas)

### 🔧 Code Contributions

We welcome code contributions! Here's how to submit them:

## 📝 Development Guidelines

### Code Style

- **Python Standards** - Follow PEP 8 style guidelines
- **Type Hints** - Use type hints for function parameters and return values
- **Docstrings** - Include docstrings for all public functions and classes
- **Error Handling** - Provide meaningful error messages and graceful failures

**Example:**
```python
def calculate_session_cost(session: SessionData, model_config: Dict[str, Any]) -> Decimal:
    """Calculate the total cost for a coding session.
    
    Args:
        session: The session data containing token usage
        model_config: Configuration containing model pricing
        
    Returns:
        The total cost as a Decimal for precise financial calculations
        
    Raises:
        ValueError: If model is not found in configuration
    """
    # Implementation here
```

### Project Architecture

The project follows a clean architecture pattern:

```
ocmonitor/
├── cli.py              # Command-line interface (Click)
├── config.py           # Configuration management
├── models/            # Pydantic data models
│   ├── analytics.py   # Analytics data structures
│   └── session.py     # Session data structures
├── services/          # Business logic services
│   ├── session_analyzer.py    # Core analysis logic
│   ├── report_generator.py    # Report generation
│   ├── export_service.py      # Data export functionality
│   └── live_monitor.py        # Real-time monitoring
├── ui/                # User interface components
│   ├── dashboard.py   # Rich dashboard components
│   └── tables.py      # Table formatting
└── utils/             # Utility functions
    ├── file_utils.py  # File processing
    ├── time_utils.py  # Time/date utilities
    └── formatting.py  # Output formatting
```

### Adding New Features

1. **Models** - Add data structures in `models/`
2. **Services** - Implement business logic in `services/`
3. **CLI** - Add commands in `cli.py`
4. **UI** - Create Rich components in `ui/`

### Testing

- **Basic Tests** - Run `python3 test_basic.py` for core functionality
- **Simple Tests** - Run `python3 test_simple.py` for import validation
- **Manual Testing** - Follow `MANUAL_TEST_GUIDE.md` for comprehensive testing

### Adding New AI Models

To add support for a new AI model:

1. **Update models.json**
   ```json
   {
     "new-model-name": {
       "input_cost_per_million": 5.0,
       "output_cost_per_million": 15.0,
       "context_window": 200000
     }
   }
   ```

2. **Test the Model**
   - Create test session data with the new model
   - Verify cost calculations are correct
   - Ensure the model appears in analytics

## 🔄 Pull Request Process

### Before Submitting

1. **Test Your Changes**
   ```bash
   python3 test_basic.py
   python3 test_simple.py
   ```

2. **Check Code Style**
   - Ensure your code follows the existing style
   - Add appropriate type hints and docstrings

3. **Update Documentation**
   - Update README.md if adding new features
   - Update model lists if adding new AI models

### Submitting the PR

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Commit Changes**
   ```bash
   git add .
   git commit -m "Add: description of your changes"
   ```

3. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### PR Template

```markdown
## Description
Brief description of changes made.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## How Has This Been Tested?
- [ ] Ran test_basic.py
- [ ] Ran test_simple.py
- [ ] Manual testing completed
- [ ] Tested with real OpenCode session data

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review of my code
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] Any dependent changes have been merged and published
```

## 🏷️ Versioning

We use [Semantic Versioning](https://semver.org/) (SemVer):

- **MAJOR** version for incompatible API changes
- **MINOR** version for new functionality in a backwards compatible manner
- **PATCH** version for backwards compatible bug fixes

## 🤝 Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

- **Be Respectful** - Treat everyone with respect and kindness
- **Be Collaborative** - Help others and accept help gracefully
- **Be Inclusive** - Welcome newcomers and diverse perspectives
- **Be Professional** - Focus on constructive feedback and solutions

## 📞 Getting Help

- **GitHub Issues** - For bug reports and feature requests
- **Discussions** - For questions and general discussion
- **Documentation** - Check README.md and guides for common questions

## 🎉 Recognition

Contributors will be acknowledged in:
- GitHub contributor list
- Release notes for significant contributions
- README.md acknowledgments section

---

Thank you for contributing to OpenCode Monitor! 🚀