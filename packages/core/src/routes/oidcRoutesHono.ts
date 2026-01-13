import { Hono } from 'hono';
import { OidcManager } from '../managers/OidcManager.js';

export function createOidcRoutes(oidcManager: OidcManager): Hono {
  const app = new Hono();

  app.get('/status', (c) => {
    return c.json(oidcManager.getStatus());
  });

  app.get('/providers', (c) => {
    return c.json({ providers: oidcManager.getProviders() });
  });

  app.get('/providers/:id', (c) => {
    const id = c.req.param('id');
    const provider = oidcManager.getProvider(id);
    if (!provider) {
      return c.json({ error: 'Provider not found' }, 404);
    }
    return c.json({ ...provider, clientSecret: '***REDACTED***' });
  });

  app.post('/providers', async (c) => {
    const body = await c.req.json();
    const { name, issuerUrl, clientId, clientSecret, scopes, enabled } = body;
    
    if (!name || !issuerUrl || !clientId || !clientSecret) {
      return c.json({ error: 'name, issuerUrl, clientId, and clientSecret are required' }, 400);
    }

    const provider = oidcManager.addProvider({
      name,
      issuerUrl,
      clientId,
      clientSecret,
      scopes: scopes ?? ['openid', 'profile', 'email'],
      enabled: enabled ?? true,
    });

    return c.json({ success: true, provider: { ...provider, clientSecret: '***REDACTED***' } });
  });

  app.put('/providers/:id', async (c) => {
    const id = c.req.param('id');
    const updates = await c.req.json();
    
    const provider = oidcManager.updateProvider(id, updates);
    if (!provider) {
      return c.json({ error: 'Provider not found' }, 404);
    }

    return c.json({ success: true, provider: { ...provider, clientSecret: '***REDACTED***' } });
  });

  app.delete('/providers/:id', (c) => {
    const id = c.req.param('id');
    const removed = oidcManager.removeProvider(id);
    if (!removed) {
      return c.json({ error: 'Provider not found' }, 404);
    }
    return c.json({ success: true });
  });

  app.post('/providers/:id/set-default', (c) => {
    const id = c.req.param('id');
    const success = oidcManager.setDefaultProvider(id);
    if (!success) {
      return c.json({ error: 'Provider not found' }, 404);
    }
    return c.json({ success: true });
  });

  app.get('/auth/url', async (c) => {
    const providerId = c.req.query('providerId');
    const redirectUri = c.req.query('redirectUri') ?? 'http://localhost:3000/auth/callback';
    
    const defaultProvider = oidcManager.getDefaultProvider();
    const targetProviderId = providerId ?? defaultProvider?.id;
    
    if (!targetProviderId) {
      return c.json({ error: 'No provider specified and no default provider set' }, 400);
    }

    const state = crypto.randomUUID();
    const url = oidcManager.buildAuthorizationUrl(targetProviderId, state, redirectUri);
    
    if (!url) {
      return c.json({ error: 'Failed to build authorization URL' }, 400);
    }

    return c.json({ url, state });
  });

  app.post('/auth/callback', async (c) => {
    const { code, state, providerId, redirectUri } = await c.req.json();
    
    if (!code || !providerId) {
      return c.json({ error: 'code and providerId are required' }, 400);
    }

    const tokens = await oidcManager.exchangeCode(
      providerId, 
      code, 
      redirectUri ?? 'http://localhost:3000/auth/callback'
    );
    
    if (!tokens) {
      return c.json({ error: 'Failed to exchange code for tokens' }, 400);
    }

    const userInfo = await oidcManager.getUserInfo(providerId, tokens.accessToken);
    if (!userInfo) {
      return c.json({ error: 'Failed to get user info' }, 400);
    }

    const sessionId = oidcManager.createSession(providerId, tokens, userInfo);
    
    return c.json({ 
      success: true, 
      sessionId, 
      user: userInfo,
      expiresAt: tokens.expiresAt,
    });
  });

  app.get('/session/:sessionId', (c) => {
    const sessionId = c.req.param('sessionId');
    const session = oidcManager.getSession(sessionId);
    
    if (!session) {
      return c.json({ error: 'Session not found or expired' }, 404);
    }

    return c.json({ success: true, ...session });
  });

  app.delete('/session/:sessionId', (c) => {
    const sessionId = c.req.param('sessionId');
    const revoked = oidcManager.revokeSession(sessionId);
    
    if (!revoked) {
      return c.json({ error: 'Session not found' }, 404);
    }

    return c.json({ success: true });
  });

  app.get('/config/redirect-urls', (c) => {
    return c.json({ urls: oidcManager.getAllowedRedirectUrls() });
  });

  app.put('/config/redirect-urls', async (c) => {
    const { urls } = await c.req.json();
    if (!Array.isArray(urls)) {
      return c.json({ error: 'urls must be an array' }, 400);
    }
    oidcManager.setAllowedRedirectUrls(urls);
    return c.json({ success: true });
  });

  return app;
}
