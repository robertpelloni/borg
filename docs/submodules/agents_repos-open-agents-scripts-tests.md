# OpenCode Installer Tests

This directory contains test scripts for validating the OpenCode installer functionality and compatibility.

## Available Tests

### 1. Compatibility Test (`test-compatibility.sh`)

Tests the installer's compatibility across different platforms and bash versions.

**Run locally:**
```bash
bash scripts/tests/test-compatibility.sh
```

**Run remotely:**
```bash
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgents/main/scripts/tests/test-compatibility.sh | bash
```

**What it tests:**
- ✅ Bash version (3.2+ required)
- ✅ Required dependencies (curl, jq)
- ✅ Script syntax validation
- ✅ Help command functionality
- ✅ List command functionality
- ✅ Profile argument parsing (with and without dashes)
- ✅ Array operations
- ✅ Parameter expansion
- ✅ Temp directory operations
- ✅ File operations
- ✅ Network connectivity

**Expected output:**
```
╔════════════════════════════════════════════════════════════════╗
║         OpenCode Installer Compatibility Test                 ║
╚════════════════════════════════════════════════════════════════╝

System Information:
  Platform: macOS
  Bash Version: 3.2.57(1)-release
  Shell: /bin/bash

[12 tests run...]

╔════════════════════════════════════════════════════════════════╗
║                  All Tests Passed! ✓                          ║
╚════════════════════════════════════════════════════════════════╝
```

---

### 2. Collision Detection Test (`test-collision-detection.sh`)

Tests the installer's file collision detection and handling strategies.

**Run locally:**
```bash
bash scripts/tests/test-collision-detection.sh
```

**What it tests:**
- ✅ Detection of existing files
- ✅ Skip existing strategy
- ✅ Overwrite strategy
- ✅ Backup & overwrite strategy
- ✅ Collision reporting
- ✅ File grouping by type

**Note:** This test creates temporary files and directories for testing collision scenarios.

---

## Running All Tests

```bash
# From repository root
for test in scripts/tests/test-*.sh; do
    echo "Running $test..."
    bash "$test"
    echo ""
done
```

---

## Test Requirements

All tests require:
- Bash 3.2 or higher
- curl (for network tests)
- jq (for JSON parsing tests)
- Internet connection (for remote fetch tests)

---

## Adding New Tests

When adding new test scripts:

1. **Naming convention:** `test-<feature>.sh`
2. **Make executable:** `chmod +x scripts/tests/test-<feature>.sh`
3. **Add shebang:** `#!/usr/bin/env bash`
4. **Use colors:** Follow existing color scheme (GREEN, RED, YELLOW)
5. **Exit codes:** Exit 0 on success, 1 on failure
6. **Documentation:** Update this README

**Example test structure:**
```bash
#!/usr/bin/env bash

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "Testing feature X..."

# Test 1
if [[ condition ]]; then
    echo -e "${GREEN}✓${NC} Test 1 passed"
else
    echo -e "${RED}✗${NC} Test 1 failed"
    exit 1
fi

echo "All tests passed!"
```

---

## CI/CD Integration

These tests can be integrated into CI/CD pipelines:

**GitHub Actions example:**
```yaml
name: Test Installer
on: [push, pull_request]
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest]
    steps:
      - uses: actions/checkout@v2
      - name: Install dependencies
        run: |
          if [[ "$OSTYPE" == "darwin"* ]]; then
            brew install jq
          else
            sudo apt-get install -y jq
          fi
      - name: Run compatibility tests
        run: bash scripts/tests/test-compatibility.sh
```

---

## Troubleshooting Tests

### Test fails with "command not found"
Install missing dependencies:
```bash
# macOS
brew install curl jq

# Ubuntu/Debian
sudo apt-get install curl jq

# Fedora/RHEL
sudo dnf install curl jq
```

### Network tests fail
Check internet connectivity:
```bash
curl -I https://github.com
```

### Permission errors
Make sure scripts are executable:
```bash
chmod +x scripts/tests/*.sh
```

---

## Test Coverage

Current test coverage:
- ✅ Platform compatibility (macOS, Linux, Windows)
- ✅ Bash version compatibility (3.2+)
- ✅ Argument parsing
- ✅ File collision handling
- ✅ Network operations
- ✅ File system operations

Future test additions:
- [ ] Profile installation end-to-end
- [ ] Component dependency resolution
- [ ] Registry validation
- [ ] Error handling scenarios
- [ ] Rollback functionality

---

## Contributing

When contributing tests:
1. Ensure tests are idempotent (can run multiple times)
2. Clean up temporary files/directories
3. Provide clear success/failure messages
4. Test on multiple platforms if possible
5. Update this README with new test documentation
