# GitHub Actions Workflows

This directory contains GitHub Actions workflows for the Kapture project.

## Workflows

### build-extension.yml
- **Trigger**: On every push to master/main, pull requests, or manual trigger
- **Purpose**: Builds and packages the Chrome extension
- **Output**: 
  - `kapture-extension-{commit-sha}.zip` - Unique artifact for each commit (retained for 30 days)
  - `kapture-extension-latest.zip` - Always contains the latest build (retained for 7 days)

### release.yml
- **Trigger**: When a version tag is pushed (e.g., `v1.0.0`)
- **Purpose**: Creates a GitHub release with the packaged extension
- **Output**: A new release with the extension zip file attached

## Usage

### Getting the Latest Extension Build

1. Go to the [Actions tab](../../actions) in the repository
2. Click on the latest "Build Extension" workflow run
3. Download the `kapture-extension-latest` artifact

### Creating a Release

1. Update the version in `extension/manifest.json`
2. Commit and push the changes
3. Create and push a version tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
4. The release workflow will automatically create a GitHub release with the extension zip

## What Gets Packaged

The workflows package all files from the `extension/` directory except:
- Mock files (`mocks/` directory)
- Screenshot images (`.jpg`, `.webp` files)
- Documentation files (`PRIVACY_POLICY.md`, `README.md`)
- Development tools (`icons/generate-icons.html`)

This ensures only the necessary files for the Chrome extension are included in the zip file.