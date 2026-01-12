/**
 * AIOS Integration Routes (Hono)
 * 
 * API endpoints for external service integrations:
 * - Integration CRUD and management
 * - OAuth flows and token management
 * - API requests to external services
 * - Webhook management
 * - Service-specific helpers
 * 
 * @module routes/integrationRoutesHono
 */

import { Hono } from 'hono';
import {
    getIntegrationService,
    type IntegrationType,
    type IntegrationStatus,
    type AuthType,
} from '../services/IntegrationService.js';

export function createIntegrationRoutes(): Hono {
    const app = new Hono();
    
    app.get('/templates', async (c) => {
        try {
            const service = getIntegrationService();
            const templates = service.listTemplates();
            return c.json({ success: true, data: templates });
        } catch (error) {
            return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to list templates' }, 500);
        }
    });
    
    app.get('/templates/:type', async (c) => {
        try {
            const service = getIntegrationService();
            const template = service.getTemplate(c.req.param('type') as IntegrationType);
            if (!template) {
                return c.json({ success: false, error: 'Template not found' }, 404);
            }
            return c.json({ success: true, data: template });
        } catch (error) {
            return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to get template' }, 500);
        }
    });
    
    app.get('/', async (c) => {
        try {
            const service = getIntegrationService();
            const type = c.req.query('type') as IntegrationType | undefined;
            const status = c.req.query('status') as IntegrationStatus | undefined;
            const enabled = c.req.query('enabled');
            
            const integrations = service.listIntegrations({
                type,
                status,
                enabled: enabled !== undefined ? enabled === 'true' : undefined,
            });
            
            return c.json({ success: true, data: integrations, total: integrations.length });
        } catch (error) {
            return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to list integrations' }, 500);
        }
    });
    
    app.get('/:id', async (c) => {
        try {
            const service = getIntegrationService();
            const integration = service.getIntegration(c.req.param('id'));
            if (!integration) {
                return c.json({ success: false, error: 'Integration not found' }, 404);
            }
            return c.json({ success: true, data: integration });
        } catch (error) {
            return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to get integration' }, 500);
        }
    });
    
    app.post('/', async (c) => {
        try {
            const service = getIntegrationService();
            const body = await c.req.json();
            
            if (!body.name || !body.type || !body.authType) {
                return c.json({ success: false, error: 'Missing required fields: name, type, authType' }, 400);
            }
            
            const integration = service.createIntegration({
                name: body.name,
                type: body.type,
                description: body.description,
                authType: body.authType,
                config: body.config,
                metadata: body.metadata,
            });
            
            return c.json({ success: true, data: integration }, 201);
        } catch (error) {
            return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to create integration' }, 500);
        }
    });
    
    app.put('/:id', async (c) => {
        try {
            const service = getIntegrationService();
            const body = await c.req.json();
            const integration = service.updateIntegration(c.req.param('id'), body);
            
            if (!integration) {
                return c.json({ success: false, error: 'Integration not found' }, 404);
            }
            
            return c.json({ success: true, data: integration });
        } catch (error) {
            return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to update integration' }, 500);
        }
    });
    
    app.delete('/:id', async (c) => {
        try {
            const service = getIntegrationService();
            const deleted = service.deleteIntegration(c.req.param('id'));
            
            if (!deleted) {
                return c.json({ success: false, error: 'Integration not found' }, 404);
            }
            
            return c.json({ success: true, message: 'Integration deleted' });
        } catch (error) {
            return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to delete integration' }, 500);
        }
    });
    
    app.post('/:id/oauth/configure', async (c) => {
        try {
            const service = getIntegrationService();
            const body = await c.req.json();
            
            if (!body.clientId || !body.clientSecret || !body.redirectUri) {
                return c.json({ success: false, error: 'Missing required fields: clientId, clientSecret, redirectUri' }, 400);
            }
            
            const integration = service.configureOAuth(c.req.param('id'), {
                clientId: body.clientId,
                clientSecret: body.clientSecret,
                authorizationUrl: body.authorizationUrl || '',
                tokenUrl: body.tokenUrl || '',
                scopes: body.scopes || [],
                redirectUri: body.redirectUri,
            });
            
            if (!integration) {
                return c.json({ success: false, error: 'Integration not found' }, 404);
            }
            
            return c.json({ success: true, data: integration });
        } catch (error) {
            return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to configure OAuth' }, 500);
        }
    });
    
    app.get('/:id/oauth/authorize', async (c) => {
        try {
            const service = getIntegrationService();
            const url = service.generateAuthorizationUrl(c.req.param('id'));
            return c.json({ success: true, data: { authorizationUrl: url } });
        } catch (error) {
            return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to generate authorization URL' }, 500);
        }
    });
    
    app.post('/:id/oauth/callback', async (c) => {
        try {
            const service = getIntegrationService();
            const body = await c.req.json();
            
            if (!body.code || !body.state) {
                return c.json({ success: false, error: 'Missing required fields: code, state' }, 400);
            }
            
            const integration = await service.handleOAuthCallback(body.code, body.state);
            return c.json({ success: true, data: integration });
        } catch (error) {
            return c.json({ success: false, error: error instanceof Error ? error.message : 'OAuth callback failed' }, 500);
        }
    });
    
    app.post('/:id/oauth/refresh', async (c) => {
        try {
            const service = getIntegrationService();
            const integration = await service.refreshOAuthToken(c.req.param('id'));
            return c.json({ success: true, data: integration });
        } catch (error) {
            return c.json({ success: false, error: error instanceof Error ? error.message : 'Token refresh failed' }, 500);
        }
    });
    
    app.post('/:id/auth/api-key', async (c) => {
        try {
            const service = getIntegrationService();
            const body = await c.req.json();
            
            if (!body.apiKey) {
                return c.json({ success: false, error: 'Missing required field: apiKey' }, 400);
            }
            
            const integration = service.setApiKey(c.req.param('id'), body.apiKey);
            if (!integration) {
                return c.json({ success: false, error: 'Integration not found' }, 404);
            }
            
            return c.json({ success: true, data: integration });
        } catch (error) {
            return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to set API key' }, 500);
        }
    });
    
    app.post('/:id/auth/token', async (c) => {
        try {
            const service = getIntegrationService();
            const body = await c.req.json();
            
            if (!body.token) {
                return c.json({ success: false, error: 'Missing required field: token' }, 400);
            }
            
            const integration = service.setPersonalToken(c.req.param('id'), body.token);
            if (!integration) {
                return c.json({ success: false, error: 'Integration not found' }, 404);
            }
            
            return c.json({ success: true, data: integration });
        } catch (error) {
            return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to set token' }, 500);
        }
    });
    
    app.post('/:id/auth/basic', async (c) => {
        try {
            const service = getIntegrationService();
            const body = await c.req.json();
            
            if (!body.username || !body.password) {
                return c.json({ success: false, error: 'Missing required fields: username, password' }, 400);
            }
            
            const integration = service.setBasicAuth(c.req.param('id'), body.username, body.password);
            if (!integration) {
                return c.json({ success: false, error: 'Integration not found' }, 404);
            }
            
            return c.json({ success: true, data: integration });
        } catch (error) {
            return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to set basic auth' }, 500);
        }
    });
    
    app.post('/:id/test', async (c) => {
        try {
            const service = getIntegrationService();
            const result = await service.testConnection(c.req.param('id'));
            return c.json({ success: result.success, data: result });
        } catch (error) {
            return c.json({ success: false, error: error instanceof Error ? error.message : 'Connection test failed' }, 500);
        }
    });
    
    app.post('/:id/disconnect', async (c) => {
        try {
            const service = getIntegrationService();
            const integration = service.disconnect(c.req.param('id'));
            if (!integration) {
                return c.json({ success: false, error: 'Integration not found' }, 404);
            }
            return c.json({ success: true, data: integration });
        } catch (error) {
            return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to disconnect' }, 500);
        }
    });
    
    app.post('/:id/request', async (c) => {
        try {
            const service = getIntegrationService();
            const body = await c.req.json();
            
            if (!body.endpoint) {
                return c.json({ success: false, error: 'Missing required field: endpoint' }, 400);
            }
            
            const result = await service.request(c.req.param('id'), body.endpoint, {
                method: body.method,
                body: body.body,
                headers: body.headers,
                query: body.query,
            });
            
            return c.json(result);
        } catch (error) {
            return c.json({ success: false, error: error instanceof Error ? error.message : 'Request failed' }, 500);
        }
    });
    
    app.get('/:id/webhooks', async (c) => {
        try {
            const service = getIntegrationService();
            const integration = service.getIntegration(c.req.param('id'));
            if (!integration) {
                return c.json({ success: false, error: 'Integration not found' }, 404);
            }
            return c.json({ success: true, data: integration.config.webhooks || [] });
        } catch (error) {
            return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to list webhooks' }, 500);
        }
    });
    
    app.post('/:id/webhooks', async (c) => {
        try {
            const service = getIntegrationService();
            const body = await c.req.json();
            
            if (!body.url || !body.events) {
                return c.json({ success: false, error: 'Missing required fields: url, events' }, 400);
            }
            
            const webhook = await service.registerWebhook(c.req.param('id'), {
                url: body.url,
                events: body.events,
                secret: body.secret,
            });
            
            return c.json({ success: true, data: webhook }, 201);
        } catch (error) {
            return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to register webhook' }, 500);
        }
    });
    
    app.delete('/:id/webhooks/:webhookId', async (c) => {
        try {
            const service = getIntegrationService();
            const deleted = await service.deleteWebhook(c.req.param('id'), c.req.param('webhookId'));
            if (!deleted) {
                return c.json({ success: false, error: 'Webhook not found' }, 404);
            }
            return c.json({ success: true, message: 'Webhook deleted' });
        } catch (error) {
            return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to delete webhook' }, 500);
        }
    });
    
    app.post('/webhooks/incoming/:integrationId', async (c) => {
        try {
            const service = getIntegrationService();
            const integrationId = c.req.param('integrationId');
            const body = await c.req.text();
            const headers: Record<string, string> = {};
            c.req.raw.headers.forEach((value, key) => { headers[key] = value; });
            
            const signature = headers['x-hub-signature-256'] || 
                            headers['x-gitlab-token'] || 
                            headers['x-slack-signature'] ||
                            headers['x-signature'];
            
            const verified = signature ? service.verifyWebhookSignature(integrationId, body, signature) : false;
            
            const eventType = headers['x-github-event'] || 
                            headers['x-gitlab-event'] || 
                            headers['x-slack-event'] ||
                            'unknown';
            
            let payload: Record<string, unknown>;
            try {
                payload = JSON.parse(body);
            } catch {
                payload = { raw: body };
            }
            
            const event = service.recordWebhookEvent({
                integrationId,
                type: eventType,
                payload,
                headers,
                signature,
                verified,
            });
            
            return c.json({ success: true, data: { eventId: event.id, verified } });
        } catch (error) {
            return c.json({ success: false, error: error instanceof Error ? error.message : 'Webhook processing failed' }, 500);
        }
    });
    
    app.get('/webhooks/events', async (c) => {
        try {
            const service = getIntegrationService();
            const integrationId = c.req.query('integrationId');
            const type = c.req.query('type');
            const since = c.req.query('since');
            const limit = c.req.query('limit');
            
            const events = service.listWebhookEvents({
                integrationId,
                type,
                since: since ? new Date(since) : undefined,
                limit: limit ? parseInt(limit, 10) : 100,
            });
            
            return c.json({ success: true, data: events, total: events.length });
        } catch (error) {
            return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to list events' }, 500);
        }
    });
    
    app.post('/:id/github/issues', async (c) => {
        try {
            const service = getIntegrationService();
            const body = await c.req.json();
            
            if (!body.owner || !body.repo || !body.title) {
                return c.json({ success: false, error: 'Missing required fields: owner, repo, title' }, 400);
            }
            
            const result = await service.githubCreateIssue(c.req.param('id'), body.owner, body.repo, {
                title: body.title,
                body: body.body,
                labels: body.labels,
            });
            
            return c.json(result);
        } catch (error) {
            return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to create issue' }, 500);
        }
    });
    
    app.post('/:id/github/pulls', async (c) => {
        try {
            const service = getIntegrationService();
            const body = await c.req.json();
            
            if (!body.owner || !body.repo || !body.title || !body.head || !body.base) {
                return c.json({ success: false, error: 'Missing required fields: owner, repo, title, head, base' }, 400);
            }
            
            const result = await service.githubCreatePR(c.req.param('id'), body.owner, body.repo, {
                title: body.title,
                body: body.body,
                head: body.head,
                base: body.base,
            });
            
            return c.json(result);
        } catch (error) {
            return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to create PR' }, 500);
        }
    });
    
    app.post('/:id/slack/message', async (c) => {
        try {
            const service = getIntegrationService();
            const body = await c.req.json();
            
            if (!body.channel || !body.text) {
                return c.json({ success: false, error: 'Missing required fields: channel, text' }, 400);
            }
            
            const result = await service.slackPostMessage(c.req.param('id'), body.channel, body.text, {
                blocks: body.blocks,
                thread_ts: body.thread_ts,
            });
            
            return c.json(result);
        } catch (error) {
            return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to send message' }, 500);
        }
    });
    
    app.post('/:id/discord/message', async (c) => {
        try {
            const service = getIntegrationService();
            const body = await c.req.json();
            
            if (!body.channelId || !body.content) {
                return c.json({ success: false, error: 'Missing required fields: channelId, content' }, 400);
            }
            
            const result = await service.discordSendMessage(c.req.param('id'), body.channelId, body.content, {
                embeds: body.embeds,
            });
            
            return c.json(result);
        } catch (error) {
            return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to send message' }, 500);
        }
    });
    
    app.post('/:id/linear/issues', async (c) => {
        try {
            const service = getIntegrationService();
            const body = await c.req.json();
            
            if (!body.title || !body.teamId) {
                return c.json({ success: false, error: 'Missing required fields: title, teamId' }, 400);
            }
            
            const result = await service.linearCreateIssue(c.req.param('id'), {
                title: body.title,
                description: body.description,
                teamId: body.teamId,
                priority: body.priority,
            });
            
            return c.json(result);
        } catch (error) {
            return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to create issue' }, 500);
        }
    });
    
    app.get('/stats', async (c) => {
        try {
            const service = getIntegrationService();
            const stats = service.getStats();
            return c.json({ success: true, data: stats });
        } catch (error) {
            return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to get stats' }, 500);
        }
    });
    
    app.post('/setup/github', async (c) => {
        try {
            const service = getIntegrationService();
            const body = await c.req.json();
            
            if (!body.token) {
                return c.json({ success: false, error: 'Missing required field: token' }, 400);
            }
            
            const integration = service.createIntegration({
                name: body.name || 'GitHub',
                type: 'github',
                description: body.description,
                authType: 'personal_token',
                config: { organization: body.organization, project: body.project },
            });
            
            service.setPersonalToken(integration.id, body.token);
            const updated = service.getIntegration(integration.id);
            
            return c.json({ success: true, data: updated }, 201);
        } catch (error) {
            return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to setup GitHub' }, 500);
        }
    });
    
    app.post('/setup/slack', async (c) => {
        try {
            const service = getIntegrationService();
            const body = await c.req.json();
            
            if (!body.token) {
                return c.json({ success: false, error: 'Missing required field: token' }, 400);
            }
            
            const integration = service.createIntegration({
                name: body.name || 'Slack',
                type: 'slack',
                description: body.description,
                authType: 'api_key',
                config: { defaultChannel: body.defaultChannel },
            });
            
            service.setApiKey(integration.id, body.token);
            const updated = service.getIntegration(integration.id);
            
            return c.json({ success: true, data: updated }, 201);
        } catch (error) {
            return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to setup Slack' }, 500);
        }
    });
    
    return app;
}

export default createIntegrationRoutes;
