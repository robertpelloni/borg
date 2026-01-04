import {
  createFunctionalMiddleware,
  CallToolMiddleware,
} from './functional-middleware.js';
import { LogManager } from '../managers/LogManager.js';

/**
 * Creates a middleware that logs tool execution
 */
export function createLoggingMiddleware(options: {
  enabled: boolean;
  logger?: (message: any) => void;
  logManager?: LogManager;
}): CallToolMiddleware {
  const log = options.logger || console.log;

  return createFunctionalMiddleware({
    transformRequest: (request, context) => {
      if (options.enabled) {
        if (options.logManager) {
           options.logManager.log({
               type: 'request',
               tool: request.params.name,
               // We might need to map sessionId to a user or context if needed
               // For now, we just pass the raw tool call info
               args: request.params.arguments,
               server: 'routed-tool' // We don't know the exact server here easily without drilling, but McpRouter handles more detailed logging?
               // Actually, McpProxyManager used to log detailed server info. 
               // McpRouter's logging middleware runs *before* routing, so we don't know the target server yet.
           });
        } else {
            log({
                type: "request",
                tool: request.params.name,
                sessionId: context.sessionId,
                args: request.params.arguments, 
            });
        }
      }
      return request;
    },
    transformResponse: (response, context) => {
      if (options.enabled) {
         if (options.logManager) {
             options.logManager.log({
                 type: 'response',
                 tool: 'unknown', // We lose the tool name context in transformResponse unless we close over it?
                 // Wait, createFunctionalMiddleware's transformResponse doesn't pass the original request.
                 // We might need a full 'around' middleware instead of simple transform/transform.
                 // But for now, let's just log the response.
                 result: response,
                 server: 'routed-tool'
             });
         } else {
            log({
                type: "response",
                isError: response.isError,
                sessionId: context.sessionId,
            });
         }
      }
      return response;
    },
  });
}
