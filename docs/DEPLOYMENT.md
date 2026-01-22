# Borg Deployment Guide

## Prerequisites

- Node.js 20+
- pnpm 8+
- Git
- Docker (optional, for sandboxed execution)

## Quick Start (Development)

```bash
# Clone repository
git clone https://github.com/robertpelloni/borg.git
cd borg

# Install dependencies
pnpm install

# Start development servers
pnpm dev
```

This starts:
- Core API on `http://localhost:3002`
- Dashboard UI on `http://localhost:5173`

## Production Deployment

### 1. Build

```bash
# Build all packages
pnpm build
```

### 2. Environment Variables

Create `.env` in the project root:

```env
# Required
NODE_ENV=production
SUPER_AI_TOKEN=your-secure-token-here

# API Keys (store securely)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Optional
PORT=3002
UI_PORT=5173
LOG_LEVEL=info
TELEMETRY_ENABLED=true

# Database (if using external)
DATABASE_URL=postgresql://...

# Redis (for distributed caching)
REDIS_URL=redis://localhost:6379
```

### 3. Run Production

```bash
# Start Core
NODE_ENV=production node packages/core/dist/index.js

# Start UI (with custom server)
NODE_ENV=production node packages/ui/server.js
```

## Docker Deployment

### Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
RUN npm install -g pnpm && pnpm install --frozen-lockfile
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/packages/ui/.next ./packages/ui/.next
COPY --from=builder /app/packages/ui/server.js ./packages/ui/
COPY --from=builder /app/packages/ui/package.json ./packages/ui/
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3002 5173
CMD ["node", "packages/core/dist/index.js"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  borg-core:
    build: .
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
      - SUPER_AI_TOKEN=${SUPER_AI_TOKEN}
    volumes:
      - ./data:/app/data
      - ./secrets:/app/secrets
    restart: unless-stopped

  borg-ui:
    build: .
    command: node packages/ui/server.js
    ports:
      - "5173:5173"
    environment:
      - NODE_ENV=production
      - CORE_API_URL=http://borg-core:3002
    depends_on:
      - borg-core
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

volumes:
  redis-data:
```

## Kubernetes Deployment

### Core Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: borg-core
spec:
  replicas: 3
  selector:
    matchLabels:
      app: borg-core
  template:
    metadata:
      labels:
        app: borg-core
    spec:
      containers:
      - name: borg-core
        image: borg:latest
        ports:
        - containerPort: 3002
        env:
        - name: NODE_ENV
          value: production
        - name: SUPER_AI_TOKEN
          valueFrom:
            secretKeyRef:
              name: borg-secrets
              key: token
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        readinessProbe:
          httpGet:
            path: /health
            port: 3002
          initialDelaySeconds: 10
          periodSeconds: 5
        livenessProbe:
          httpGet:
            path: /health
            port: 3002
          initialDelaySeconds: 30
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: borg-core
spec:
  selector:
    app: borg-core
  ports:
  - port: 3002
    targetPort: 3002
  type: ClusterIP
```

## Monitoring

### Prometheus Metrics

Metrics endpoint: `GET /metrics`

Add to Prometheus scrape config:

```yaml
scrape_configs:
  - job_name: 'borg'
    static_configs:
      - targets: ['borg-core:3002']
    metrics_path: /metrics
```

### Health Checks

- `GET /health` - Basic health check
- `GET /api/system/status` - Detailed status

### Logging

Logs are written to:
- Console (stdout)
- `data/logs/` directory (JSON format)
- `data/audit/` directory (audit logs)

Configure log level via `LOG_LEVEL` environment variable.

## Security Checklist

- [ ] Set strong `SUPER_AI_TOKEN`
- [ ] Use HTTPS in production (reverse proxy)
- [ ] Store secrets in `.secrets.json` (auto-encrypted)
- [ ] Enable audit logging
- [ ] Configure rate limiting
- [ ] Set up API key rotation schedule
- [ ] Review firewall rules
- [ ] Enable request logging

## Scaling

### Horizontal Scaling

For stateless scaling:
1. Use Redis for session storage
2. Use shared filesystem or S3 for data
3. Load balance with sticky sessions for WebSocket

### Performance Tuning

```env
# Node.js
NODE_OPTIONS="--max-old-space-size=4096"

# Connection pools
DB_POOL_MIN=2
DB_POOL_MAX=20

# Caching
CACHE_MAX_SIZE=10000
CACHE_TTL=300000

# Rate limiting
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100
```

## Troubleshooting

### Common Issues

**Port already in use:**
```bash
lsof -i :3002  # Find process
kill -9 <PID>  # Kill it
```

**Memory issues:**
```bash
NODE_OPTIONS="--max-old-space-size=4096" node ...
```

**WebSocket connection fails:**
- Check CORS configuration
- Verify firewall allows WebSocket upgrades
- Check reverse proxy WebSocket support

### Debug Mode

```bash
DEBUG=borg:* node packages/core/dist/index.js
```
