/**
 * AIOS CLI Proxy Routes (Hono)
 * 
 * REST API for managing OAuth-based AI provider accounts.
 * Handles account management, OAuth flows, session management, and quota tracking.
 * 
 * Endpoints:
 * - GET /accounts - List all accounts
 * - POST /accounts - Add a new account
 * - GET /accounts/:id - Get account details
 * - DELETE /accounts/:id - Remove an account
 * - PATCH /accounts/:id/status - Update account status
 * - POST /accounts/:id/oauth/start - Start OAuth flow
 * - POST /accounts/:id/oauth/complete - Complete OAuth flow
 * - GET /sessions - List all sessions
 * - POST /sessions - Start a new session
 * - GET /sessions/:id - Get session details
 * - DELETE /sessions/:id - Stop a session
 * - GET /providers - List supported providers
 * - GET /providers/:id - Get provider info
 * - GET /providers/:id/endpoint - Get proxy endpoint for provider
 * 
 * @module routes/cliProxyRoutesHono
 */

import { Hono } from 'hono';
import { getCLIProxyManager, CLIProxyProvider } from '../managers/CLIProxyManager.js';

export function createCLIProxyRoutes() {
    const router = new Hono();
    const manager = getCLIProxyManager();

    // ============================================
    // Account Management
    // ============================================

    /**
     * GET /accounts - List all accounts
     */
    router.get('/accounts', (c) => {
        try {
            const provider = c.req.query('provider') as CLIProxyProvider | undefined;
            
            let accounts;
            if (provider) {
                accounts = manager.getAccountsByProvider(provider);
            } else {
                accounts = manager.getAccounts();
            }
            
            return c.json({
                success: true,
                accounts,
                total: accounts.length,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * POST /accounts - Add a new account
     */
    router.post('/accounts', async (c) => {
        try {
            const body = await c.req.json();
            const { provider, email, displayName } = body;
            
            if (!provider) {
                return c.json({
                    success: false,
                    error: 'Provider is required',
                }, 400);
            }
            
            const validProviders = manager.getSupportedProviders();
            if (!validProviders.includes(provider)) {
                return c.json({
                    success: false,
                    error: `Invalid provider. Supported: ${validProviders.join(', ')}`,
                }, 400);
            }
            
            const account = await manager.addAccount({
                provider,
                email,
                displayName,
            });
            
            return c.json({
                success: true,
                account,
            }, 201);
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * GET /accounts/:id - Get account details
     */
    router.get('/accounts/:id', (c) => {
        try {
            const id = c.req.param('id');
            const account = manager.getAccount(id);
            
            if (!account) {
                return c.json({
                    success: false,
                    error: 'Account not found',
                }, 404);
            }
            
            return c.json({
                success: true,
                account,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * DELETE /accounts/:id - Remove an account
     */
    router.delete('/accounts/:id', (c) => {
        try {
            const id = c.req.param('id');
            const account = manager.getAccount(id);
            
            if (!account) {
                return c.json({
                    success: false,
                    error: 'Account not found',
                }, 404);
            }
            
            manager.removeAccount(id);
            
            return c.json({
                success: true,
                message: 'Account removed',
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * PATCH /accounts/:id/status - Update account status
     */
    router.patch('/accounts/:id/status', async (c) => {
        try {
            const id = c.req.param('id');
            const body = await c.req.json();
            const { status } = body;
            
            if (!status || !['active', 'paused', 'expired', 'error'].includes(status)) {
                return c.json({
                    success: false,
                    error: 'Invalid status. Must be: active, paused, expired, or error',
                }, 400);
            }
            
            manager.updateAccountStatus(id, status);
            const account = manager.getAccount(id);
            
            return c.json({
                success: true,
                account,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * PATCH /accounts/:id/quota - Update account quota
     */
    router.patch('/accounts/:id/quota', async (c) => {
        try {
            const id = c.req.param('id');
            const body = await c.req.json();
            const { quotaUsed } = body;
            
            if (typeof quotaUsed !== 'number') {
                return c.json({
                    success: false,
                    error: 'quotaUsed must be a number',
                }, 400);
            }
            
            manager.updateQuota(id, quotaUsed);
            const account = manager.getAccount(id);
            
            return c.json({
                success: true,
                account,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    // ============================================
    // OAuth Flow
    // ============================================

    /**
     * POST /accounts/:id/oauth/start - Start OAuth flow
     */
    router.post('/accounts/:id/oauth/start', async (c) => {
        try {
            const id = c.req.param('id');
            const result = await manager.startOAuthFlow(id);
            
            return c.json({
                success: true,
                ...result,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * POST /accounts/:id/oauth/complete - Complete OAuth flow
     */
    router.post('/accounts/:id/oauth/complete', async (c) => {
        try {
            const id = c.req.param('id');
            const body = await c.req.json();
            const { code, state } = body;
            
            if (!code || !state) {
                return c.json({
                    success: false,
                    error: 'code and state are required',
                }, 400);
            }
            
            const success = await manager.completeOAuth({
                accountId: id,
                code,
                state,
            });
            
            return c.json({
                success,
                message: success ? 'OAuth completed successfully' : 'OAuth failed',
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * GET /oauth/callback - OAuth callback handler
     */
    router.get('/oauth/callback', async (c) => {
        try {
            const code = c.req.query('code');
            const state = c.req.query('state');
            const accountId = c.req.query('account_id');
            
            if (!code || !state || !accountId) {
                return c.json({
                    success: false,
                    error: 'Missing required parameters',
                }, 400);
            }
            
            const success = await manager.completeOAuth({
                accountId,
                code,
                state,
            });
            
            // In a real implementation, redirect to a success page
            return c.html(`
                <!DOCTYPE html>
                <html>
                <head><title>OAuth ${success ? 'Success' : 'Failed'}</title></head>
                <body>
                    <h1>${success ? 'Authentication Successful!' : 'Authentication Failed'}</h1>
                    <p>${success ? 'You can close this window.' : 'Please try again.'}</p>
                </body>
                </html>
            `);
        } catch (error) {
            return c.html(`
                <!DOCTYPE html>
                <html>
                <head><title>OAuth Error</title></head>
                <body>
                    <h1>Authentication Error</h1>
                    <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
                </body>
                </html>
            `);
        }
    });

    // ============================================
    // Session Management
    // ============================================

    /**
     * GET /sessions - List all sessions
     */
    router.get('/sessions', (c) => {
        try {
            const sessions = manager.getSessions();
            
            return c.json({
                success: true,
                sessions,
                total: sessions.length,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * POST /sessions - Start a new session
     */
    router.post('/sessions', async (c) => {
        try {
            const body = await c.req.json();
            const { accountId } = body;
            
            if (!accountId) {
                return c.json({
                    success: false,
                    error: 'accountId is required',
                }, 400);
            }
            
            const session = await manager.startSession(accountId);
            
            return c.json({
                success: true,
                session,
            }, 201);
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * GET /sessions/:id - Get session details
     */
    router.get('/sessions/:id', (c) => {
        try {
            const id = c.req.param('id');
            const session = manager.getSession(id);
            
            if (!session) {
                return c.json({
                    success: false,
                    error: 'Session not found',
                }, 404);
            }
            
            return c.json({
                success: true,
                session,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * DELETE /sessions/:id - Stop a session
     */
    router.delete('/sessions/:id', async (c) => {
        try {
            const id = c.req.param('id');
            await manager.stopSession(id);
            
            return c.json({
                success: true,
                message: 'Session stopped',
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    // ============================================
    // Provider Information
    // ============================================

    /**
     * GET /providers - List supported providers
     */
    router.get('/providers', (c) => {
        try {
            const providers = manager.getSupportedProviders();
            const providerInfo = providers.map(p => ({
                id: p,
                ...manager.getProviderInfo(p),
                accountCount: manager.getAccountsByProvider(p).length,
            }));
            
            return c.json({
                success: true,
                providers: providerInfo,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * GET /providers/:id - Get provider info
     */
    router.get('/providers/:id', (c) => {
        try {
            const id = c.req.param('id') as CLIProxyProvider;
            const providers = manager.getSupportedProviders();
            
            if (!providers.includes(id)) {
                return c.json({
                    success: false,
                    error: `Provider not found. Supported: ${providers.join(', ')}`,
                }, 404);
            }
            
            const info = manager.getProviderInfo(id);
            const accounts = manager.getAccountsByProvider(id);
            const bestAccount = manager.getBestAccount(id);
            
            return c.json({
                success: true,
                provider: {
                    id,
                    ...info,
                    accounts: accounts.length,
                    bestAccountId: bestAccount?.id,
                },
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * GET /providers/:id/endpoint - Get proxy endpoint for provider
     */
    router.get('/providers/:id/endpoint', (c) => {
        try {
            const id = c.req.param('id') as CLIProxyProvider;
            const providers = manager.getSupportedProviders();
            
            if (!providers.includes(id)) {
                return c.json({
                    success: false,
                    error: `Provider not found. Supported: ${providers.join(', ')}`,
                }, 404);
            }
            
            const endpoint = manager.getProxyEndpoint(id);
            
            return c.json({
                success: true,
                provider: id,
                endpoint,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    // ============================================
    // Best Account Selection
    // ============================================

    /**
     * GET /best-account/:provider - Get best available account for provider
     */
    router.get('/best-account/:provider', (c) => {
        try {
            const provider = c.req.param('provider') as CLIProxyProvider;
            const providers = manager.getSupportedProviders();
            
            if (!providers.includes(provider)) {
                return c.json({
                    success: false,
                    error: `Provider not found. Supported: ${providers.join(', ')}`,
                }, 404);
            }
            
            const account = manager.getBestAccount(provider);
            
            if (!account) {
                return c.json({
                    success: false,
                    error: `No active accounts available for ${provider}`,
                }, 404);
            }
            
            return c.json({
                success: true,
                account,
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    // ============================================
    // Manager Control
    // ============================================

    /**
     * POST /initialize - Initialize the manager
     */
    router.post('/initialize', async (c) => {
        try {
            await manager.initialize();
            
            return c.json({
                success: true,
                message: 'CLI Proxy Manager initialized',
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    /**
     * POST /shutdown - Shutdown the manager
     */
    router.post('/shutdown', async (c) => {
        try {
            await manager.shutdown();
            
            return c.json({
                success: true,
                message: 'CLI Proxy Manager shutdown complete',
            });
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    });

    return router;
}
