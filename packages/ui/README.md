# Super AI Plugin - Dashboard UI

Next.js-based dashboard for the Super AI Plugin.

## Development

```bash
pnpm dev
```

The dashboard will be available at http://localhost:5173

## Building

```bash
pnpm build
```

## Deployment to Vercel

This dashboard is built with Next.js and can be easily deployed to Vercel:

### Deploy from Vercel Dashboard (Recommended)

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project" and import your repository
3. Configure the project:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `packages/ui`
   - **Build Command**: `pnpm build` (auto-detected)
   - **Output Directory**: `.next` (auto-detected)
4. Click "Deploy"

Vercel automatically handles the monorepo structure and pnpm workspaces.

### Deploy with Vercel CLI

```bash
cd packages/ui
npx vercel
```

Follow the prompts to configure your deployment.

### Environment Variables

If you need to configure the API backend URL for production, add:

- `NEXT_PUBLIC_API_URL`: URL of the backend API (defaults to http://localhost:3000)

## Architecture

- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Real-time**: Socket.io Client
- **Backend**: Connects to the Core API on port 3000

## Pages

- `/` - Dashboard (System Overview)
- `/marketplace` - Plugin Marketplace
- `/secrets` - API Keys & Secrets
- `/mcp` - MCP Servers
- `/agents` - Agents & Active Intelligence
- `/prompts` - Prompt Library
- `/context` - Context Management
- `/hooks` - System Hooks
- `/inspector` - Traffic Inspector
