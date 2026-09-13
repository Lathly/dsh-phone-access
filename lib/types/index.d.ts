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
import type { Context } from '@deepseek-ai/cordis';
export declare const name = "phone-access";
export declare const inject: string[];
/** Plugin configuration. */
export interface Config {
    /** Port for the trampoline HTTP server. */
    port?: number;
    /** Path to the DSH web-launch-token file. */
    tokenFile?: string;
    /** Target URL for redirects (DSH Web UI base URL). */
    targetUrl?: string;
}
/** Register the phone-access trampoline plugin. */
export declare function apply(ctx: Context, config?: Config): void;
//# sourceMappingURL=index.d.ts.map