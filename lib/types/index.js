/**
 * @deepseek-ai/dsh-phone-access — DSH phone access token trampoline
 *
 * Provides an HTTP redirect service that allows remote phone access to the
 * DSH Web UI via Tailscale or any network proxy. The trampoline reads the
 * current DSH web-launch-token file on each request and issues fresh
 * token-authenticated redirect URLs, enabling phone access that survives
 * DSH restarts without manual URL updates.
 *
 * Phone access path:
 *   phone bookmark → trampoline (this plugin) → 302 → DSH token URL
 *   → DSH validates token → sets cookie → 303 → DSH Web UI
 *
 * @module @deepseek-ai/dsh-phone-access
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { defineTool } from '@deepseek-ai/dsh-tools';
export const name = 'phone-access';
export const inject = [];
let server = null;
let serverPort = 0;
let tokenFilePath = '';
let targetUrl = '';
function defaultConfig() {
    return {
        port: 3090,
        tokenFile: `${homedir()}/.dsh/web-launch-token`,
        targetUrl: 'https://pop-os.taildc49b0.ts.net',
    };
}
async function readToken(path) {
    const content = await readFile(path, 'utf-8');
    return content.trim();
}
async function handleRequest(req, res, config) {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    try {
        if (url.pathname === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', target: config.targetUrl }));
            return;
        }
        if (url.pathname === '/dsh-url' || url.pathname === '/url') {
            const token = await readToken(config.tokenFile);
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(`${config.targetUrl}/?token=${token}`);
            return;
        }
        // Default: token-authenticated redirect
        const token = await readToken(config.tokenFile);
        const redirectUrl = `${config.targetUrl}/?token=${token}`;
        res.writeHead(302, { 'Location': redirectUrl });
        res.end();
    }
    catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'error',
            message: err instanceof Error ? err.message : String(err),
        }));
    }
}
/** Register the phone-access trampoline plugin. */
export function apply(ctx, config = {}) {
    const cfg = { ...defaultConfig(), ...config };
    serverPort = cfg.port;
    tokenFilePath = cfg.tokenFile;
    targetUrl = cfg.targetUrl;
    ctx.logger.info('phone-access', `registering trampoline on port ${cfg.port}`);
    server = createServer((req, res) => {
        handleRequest(req, res, cfg);
    });
    server.listen(cfg.port, () => {
        ctx.logger.info('phone-access', `trampoline listening on :${cfg.port}`);
    });
    // Register a tool for the agent to query the trampoline status
    ctx.tools.register(defineTool({
        name: 'phone_access_status',
        description: 'Query the phone access trampoline status and configuration.',
        parameters: {},
        output: {
            schema: { type: 'json' },
            render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
        },
        execute: async () => {
            return {
                status: server?.listening ? 'running' : 'stopped',
                port: serverPort,
                target: targetUrl,
                tokenFile: tokenFilePath,
            };
        },
    }));
    // Register a tool to get the current phone access URL
    ctx.tools.register(defineTool({
        name: 'phone_access_url',
        description: 'Get the current phone access URL (with fresh token).',
        parameters: {},
        output: {
            schema: { type: 'json' },
            render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
        },
        execute: async () => {
            try {
                const token = await readToken(tokenFilePath);
                return { url: `${targetUrl}/?token=${token}`, bookmark: `http://localhost:${serverPort}/dsh` };
            }
            catch (err) {
                return { error: err instanceof Error ? err.message : String(err) };
            }
        },
    }));
    ctx.effect(() => {
        return () => {
            ctx.logger.info('phone-access', 'shutting down trampoline');
            server?.close();
            server = null;
        };
    }, 'phone-access: shutdown');
}
//# sourceMappingURL=index.js.map