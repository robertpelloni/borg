# OpenCode Gemini OAuth Plugin

OAuth authentication plugin for Google Gemini CLI in OpenCode.

## Installation Steps

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/shantur/opencode-gemini-auth.git
cd opencode-gemini-auth
bun install
```

### 2. Configure OpenCode

Edit your OpenCode configuration file to add the plugin:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "file:///Users/shantur/Coding/opencode-gemini-auth"
  ]
}
```

**Note:** Update the file path to match where you cloned the repository.

### 3. Login with OpenCode

```bash
opencode auth login
```

### 4. Select Google Provider

When prompted, select **"google"** or **"OAuth with Google (Gemini)"** from the authentication methods.

Then follow the OAuth flow:
- A browser window will open
- Complete Google authentication
- Copy the final localhost URL
- Paste it back in the terminal

## Features

- ✅ OAuth 2.0 authentication with Google
- ✅ Support for Google Cloud Project ID (optional for free tier)
- ✅ Automatic token refresh
- ✅ Request/response transformation for Cloud Code Assist API
- ✅ Support for both streaming and non-streaming responses
- ✅ Automatic project setup for free tier users

## Authentication Flow

1. User selects "OAuth with Google (Gemini)"
2. Optionally enters Google Cloud Project ID (not required for free tier)
3. Opens OAuth URL in browser
4. Completes Google authentication
5. Pastes callback URL back into the application
6. Plugin handles token exchange and storage

## Requirements

- Node.js >= 18.0.0
- OpenCode AI plugin system

## Google Cloud Setup

For non-free tier usage, you'll need:
1. A Google Cloud Project
2. Cloud Code Assist API enabled

Free tier users can skip project setup - the plugin will automatically use Google's managed project.

## API Endpoints

This plugin transforms requests between:
- **From**: `generativelanguage.googleapis.com` (Generative Language API)
- **To**: `cloudcode-pa.googleapis.com` (Cloud Code Assist API)

## License

MIT

## Author

@shantur

## Repository

[GitHub](https://github.com/shantur/opencode-gemini-auth)