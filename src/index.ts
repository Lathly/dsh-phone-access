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

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'

export const name = 'phone-access'
export const inject: string[] = ['tools']

/** Plugin configuration. */
export interface Config {
  /** Port for the trampoline HTTP server. */
  port?: number
  /** Path to the DSH web-launch-token file. */
  tokenFile?: string
  /** Target URL for redirects (DSH Web UI base URL). */
  targetUrl?: string
}

let server: ReturnType<typeof createServer> | null = null
let serverPort = 0
let tokenFilePath = ''
let targetUrl = ''

function defaultConfig(): Required<Config> {
  return {
    port: 3090,
    tokenFile: `${homedir()}/.dsh/web-launch-token`,
    targetUrl: 'https://pop-os.taildc49b0.ts.net',
  }
}

async function readToken(path: string): Promise<string> {
  const content = await readFile(path, 'utf-8')
  return content.trim()
}

async function handleRequest(req: IncomingMessage, res: ServerResponse, config: Required<Config>) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

  try {
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', target: config.targetUrl }))
      return
    }

    if (url.pathname === '/dsh-url' || url.pathname === '/url') {
      const token = await readToken(config.tokenFile)
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end(`${config.targetUrl}/?token=${token}`)
      return
    }

    // Default: token-authenticated redirect
    const token = await readToken(config.tokenFile)
    const redirectUrl = `${config.targetUrl}/?token=${token}`
    res.writeHead(302, { 'Location': redirectUrl })
    res.end()
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
    }))
  }
}

/** Register the phone-access trampoline plugin. */
export function apply(ctx: Context, config: Config = {}): void {
  const cfg: Required<Config> = { ...defaultConfig(), ...config }

  serverPort = cfg.port
  tokenFilePath = cfg.tokenFile
  targetUrl = cfg.targetUrl

  ctx.logger.info('phone-access', `registering trampoline on port ${cfg.port}`)

  server = createServer((req, res) => {
    handleRequest(req, res, cfg)
  })

  server.listen(cfg.port, () => {
    ctx.logger.info('phone-access', `trampoline listening on :${cfg.port}`)
  })

  // Register a tool for the agent to query the trampoline status
  ctx.tools.register(defineTool({
    name: 'phone_access_status',
    description: 'Query the phone access trampoline status and configuration.',
    parameters: {},
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    execute: async (): Promise<JsonValue> => {
      return {
        status: server?.listening ? 'running' : 'stopped',
        port: serverPort,
        target: targetUrl,
        tokenFile: tokenFilePath,
      } as unknown as JsonValue
    },
  }))

  // Register a tool to get the current phone access URL
  ctx.tools.register(defineTool({
    name: 'phone_access_url',
    description: 'Get the current phone access URL (with fresh token).',
    parameters: {},
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    execute: async (): Promise<JsonValue> => {
      try {
        const token = await readToken(tokenFilePath)
        return { url: `${targetUrl}/?token=${token}`, bookmark: `http://localhost:${serverPort}/dsh` } as unknown as JsonValue
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) } as unknown as JsonValue
      }
    },
  }))

  ctx.effect(() => {
    return () => {
      ctx.logger.info('phone-access', 'shutting down trampoline')
      server?.close()
      server = null
    }
  }, 'phone-access: shutdown')
}