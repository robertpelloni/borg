# 🧪 OpenCode Monitor - Manual Test Guide

This guide will help you manually test all functionality of the new OpenCode Monitor implementation.

## 📋 Pre-Test Setup

### 1. **Environment Setup**
```bash
cd ocmonitor
python3 -m pip install -r requirements.txt
```

**Note**: You may see warnings about scripts not being in PATH. This is normal and will be resolved in the next step.

### 2. **Basic Installation Test**
```bash
# Install in development mode
python3 -m pip install -e .

# Add Python scripts directory to PATH (if needed)
# This command will show you the scripts directory:
python3 -m site --user-base
# Add /path/from/above/bin to your PATH

# For macOS/Linux with bash/zsh, add this line to ~/.bashrc or ~/.zshrc:
# export PATH="$(python3 -m site --user-base)/bin:$PATH"

# Verify installation
ocmonitor --help
```
**Expected**: Should show main help with all commands listed

### 3. **Run Basic Functionality Test**
```bash
python3 test_basic.py
```
**Expected**: All 4 tests should pass with ✅ symbols

## 🔧 Configuration Tests

### Test 1: Configuration Display
```bash
ocmonitor config show
```
**Expected Output:**
- 📋 Current Configuration header
- All sections: Paths, UI Settings, Export Settings, Models
- Should show 3 configured models (claude-sonnet-4, claude-opus-4, claude-opus-4.1)

### Test 2: Configuration Files
```bash
# Check config file exists
ls -la config.toml

# Check models file exists
ls -la models.json

# View config content
cat config.toml
```
**Expected**: Both files should exist and contain valid configuration

## 📁 File System Tests

### Test 3: Directory Validation
```bash
# Test with non-existent directory
ocmonitor sessions /non/existent/path
```
**Expected**: Should show user-friendly error message

### Test 4: Default Directory Handling
```bash
# Test with default directory (will likely not exist)
ocmonitor sessions
```
**Expected**: Should attempt to use default path and show appropriate message

## 📊 Basic Analysis Tests

### Test 5: Session Analysis (Empty Directory)
```bash
# Create test directory
mkdir -p test_sessions

# Test with empty directory
ocmonitor sessions test_sessions
```
**Expected**: "No sessions found" message

### Test 6: Create Mock Session Data
```bash
# Create mock session directory
mkdir -p test_sessions/ses_test_001

# Create mock interaction file
cat > test_sessions/ses_test_001/msg_001.json << 'EOF'
{
  "id": "msg_001",
  "role": "user",
  "sessionID": "ses_test_001",
  "modelID": "claude-sonnet-4-20250514",
  "tokens": {
    "input": 100,
    "output": 500,
    "cache": {
      "write": 50,
      "read": 25
    }
  },
  "time": {
    "created": 1705147082000,
    "completed": 1705147087000
  }
}
EOF

# Create second interaction file
cat > test_sessions/ses_test_001/msg_002.json << 'EOF'
{
  "id": "msg_002",
  "role": "assistant",
  "sessionID": "ses_test_001",
  "modelID": "claude-sonnet-4-20250514",
  "tokens": {
    "input": 75,
    "output": 300,
    "cache": {
      "write": 0,
      "read": 100
    }
  },
  "time": {
    "created": 1705147090000,
    "completed": 1705147095000
  }
}
EOF
```

### Test 7: Single Session Analysis
```bash
ocmonitor session test_sessions/ses_test_001
```
**Expected Output:**
- Beautiful Rich table with session details
- 2 interaction files listed
- Token counts: input, output, cache read/write
- Cost calculations
- Duration information
- Summary panel with totals

### Test 8: Sessions Summary
```bash
ocmonitor sessions test_sessions
```
**Expected Output:**
- Sessions summary table
- 1 session shown
- Aggregated token counts
- Total cost calculation
- Summary panel with overall statistics

## 🎨 Output Format Tests

### Test 9: JSON Output
```bash
ocmonitor session test_sessions/ses_test_001 --format json
```
**Expected**: Valid JSON output with session data

### Test 10: Table Output (Default)
```bash
ocmonitor sessions test_sessions --format table
```
**Expected**: Rich formatted table with colors and proper alignment

## 📤 Export Tests

### Test 11: CSV Export
```bash
ocmonitor export sessions test_sessions --format csv --output test_export.csv
```
**Expected Output:**
- ✅ Export completed successfully message
- File path and size information
- CSV file created with proper data

### Test 12: JSON Export
```bash
ocmonitor export sessions test_sessions --format json --output test_export.json
```
**Expected Output:**
- ✅ Export completed successfully message
- JSON file created with metadata

### Test 13: Verify Export Files
```bash
# Check CSV structure
head -10 test_export.csv

# Check JSON structure
python3 -m json.tool test_export.json | head -20

# Check file sizes
ls -lh test_export.*
```
**Expected**: Both files should contain valid data

## 📅 Time-Based Analysis Tests

### Test 14: Create Additional Mock Data
```bash
# Create second session with different date
mkdir -p test_sessions/ses_test_002

cat > test_sessions/ses_test_002/msg_001.json << 'EOF'
{
  "id": "msg_001",
  "sessionID": "ses_test_002",
  "modelID": "claude-opus-4",
  "tokens": {
    "input": 200,
    "output": 800,
    "cache": {
      "write": 100,
      "read": 50
    }
  },
  "time": {
    "created": 1705233482000,
    "completed": 1705233492000
  }
}
EOF
```

### Test 15: Daily Breakdown
```bash
ocmonitor daily test_sessions
```
**Expected**: Daily breakdown table with dates and usage

### Test 16: Model Breakdown
```bash
ocmonitor models test_sessions
```
**Expected**:
- Model usage table
- Both claude-sonnet-4 and claude-opus-4 listed
- Token counts and costs per model
- Percentage breakdown

## 🔴 Error Handling Tests

### Test 17: Invalid JSON File
```bash
# Create invalid JSON
echo "{ invalid json" > test_sessions/ses_test_001/invalid.json

# Test with invalid file
ocmonitor session test_sessions/ses_test_001
```
**Expected**: Should handle invalid JSON gracefully and continue processing valid files

### Test 18: Permission Errors
```bash
# Create unreadable file
touch test_sessions/ses_test_001/unreadable.json
chmod 000 test_sessions/ses_test_001/unreadable.json

# Test handling
ocmonitor session test_sessions/ses_test_001
```
**Expected**: Should handle permission errors gracefully

### Test 19: Missing Required Fields
```bash
cat > test_sessions/ses_test_001/incomplete.json << 'EOF'
{
  "id": "incomplete",
  "sessionID": "ses_test_001"
}
EOF

ocmonitor session test_sessions/ses_test_001
```
**Expected**: Should handle missing fields and show appropriate warnings

## 📺 Live Monitoring Tests

### Test 20: Live Dashboard Setup
```bash
# Test validation
ocmonitor live test_sessions
```
**Expected**: Should show validation warnings and start monitoring

### Test 21: Live Dashboard Interaction
1. Start live dashboard in one terminal:
   ```bash
   ocmonitor live test_sessions --interval 2
   ```

2. In another terminal, add a new file:
   ```bash
   cat > test_sessions/ses_test_002/msg_002.json << 'EOF'
   {
     "id": "msg_002",
     "sessionID": "ses_test_002",
     "modelID": "claude-opus-4",
     "tokens": {
       "input": 150,
       "output": 400
     },
     "time": {
       "created": 1705233500000,
       "completed": 1705233505000
     }
   }
   EOF
   ```

3. Watch the dashboard update

**Expected**: Dashboard should refresh and show updated data

## 🎯 Advanced Feature Tests

### Test 22: Date Filtering
```bash
ocmonitor models test_sessions --start-date 2024-01-01 --end-date 2024-12-31
```

### Test 23: Verbose Mode
```bash
ocmonitor sessions test_sessions --verbose
```
**Expected**: More detailed output and error information

### Test 24: Help Commands
```bash
ocmonitor --help
ocmonitor session --help
ocmonitor export --help
ocmonitor config --help
```
**Expected**: Comprehensive help for each command

## 🧹 Cleanup Tests

### Test 25: Export Directory
```bash
ls -la exports/
```
**Expected**: Should contain exported files

### Test 26: File Permissions
```bash
# Reset permissions
chmod 644 test_sessions/ses_test_001/unreadable.json

# Cleanup test data
rm -rf test_sessions/
rm -f test_export.*
```

## ✅ Success Criteria

### **Basic Functionality** ✓
- [ ] All commands execute without Python errors
- [ ] Configuration loads correctly
- [ ] Help system works
- [ ] Error messages are user-friendly

### **Data Processing** ✓
- [ ] Parses JSON files correctly
- [ ] Calculates costs accurately
- [ ] Handles missing/invalid data gracefully
- [ ] Aggregates data correctly across sessions

### **Output Quality** ✓
- [ ] Rich tables display properly with colors
- [ ] JSON output is valid
- [ ] CSV exports are properly formatted
- [ ] Progress bars and indicators work

### **Live Monitoring** ✓
- [ ] Dashboard starts and displays data
- [ ] Updates in real-time
- [ ] Handles Ctrl+C gracefully
- [ ] Shows appropriate status information

### **Error Resilience** ✓
- [ ] Handles file system errors
- [ ] Recovers from JSON parsing errors
- [ ] Provides helpful error messages
- [ ] Continues processing despite individual file failures

## 🐛 Common Issues & Solutions

### Issue: "No module named 'ocmonitor'"
**Solution**: Run `pip install -e .` from the ocmonitor directory

### Issue: "Permission denied"
**Solution**: Check file permissions and directory access

### Issue: Rich tables not displaying properly
**Solution**: Ensure terminal supports UTF-8 and colors

### Issue: "No sessions found"
**Solution**: Verify the directory path and session folder structure (ses_* directories)

## 📞 Support

If any tests fail:
1. Check the error message for specific details
2. Run with `--verbose` flag for more information
3. Verify dependencies are installed correctly
4. Check file permissions and paths

---

**Happy Testing! 🎉**

This guide should help you verify that all functionality works correctly. Each test builds on the previous one, so it's best to run them in order.