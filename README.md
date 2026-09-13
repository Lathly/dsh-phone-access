# @deepseek-ai/dsh-phone-access

DSH phone access token trampoline — HTTP redirect service for remote phone access to DSH Web UI via Tailscale or any network proxy.

## Overview

This plugin provides an HTTP redirect service that allows remote phone access to the DSH Web UI without manual token management. The trampoline reads the current DSH web-launch-token file on each request and issues fresh token-authenticated redirect URLs.

## Phone access path

```
phone bookmark → trampoline (this plugin) → 302 → DSH token URL
→ DSH validates token → sets cookie → 303 → DSH Web UI
```

## Installation

Install the plugin package:

```bash
pnpm add @deepseek-ai/dsh-phone-access
```

Enable it in your DSH configuration (e.g., `~/.dsh/profiles/default/cordis.yml`):

```yaml
plugins:
  - id: phone-access
    name: "@deepseek-ai/dsh-phone-access"
    config:
      port: 3090
      tokenFile: "/home/andré/.dsh/web-launch-token"
      targetUrl: "https://pop-os.taildc49b0.ts.net"
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | `number` | `3090` | Port for the trampoline HTTP server |
| `tokenFile` | `string` | `~/.dsh/web-launch-token` | Path to the DSH web-launch-token file |
| `targetUrl` | `string` | `https://pop-os.taildc49b0.ts.net` | Target URL for redirects (DSH Web UI base URL) |

## Phone bookmark

Bookmark the trampoline URL on your phone:

```
http://pop-os.taildc49b0.ts.net:3090/dsh
```

The trampoline performs a fresh token exchange on every hit, so the bookmark works whether the cookie is fresh, expired, or never issued — including right after a DSH restart.

## Agent tools

This plugin registers two DSH tools:

- **`phone_access_status`** — Query the phone access trampoline status and configuration.
- **`phone_access_url`** — Get the current phone access URL (with fresh token).

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `/` | Token-authenticated redirect to DSH Web UI |
| `/dsh` | Same as `/` (alias) |
| `/dsh-url` | Plain text: current token-authenticated DSH URL |
| `/health` | JSON: `{"status": "ok", "target": "..."}` |

## Requirements

- DSH running locally on port 3080 (or custom configured port)
- Tailscale serve configured to proxy port 443 to localhost:3080
- Tailscale network access for the phone
- DSH web-launch-token file readable by the plugin

## Troubleshooting

- **Page renders, no conversations** — The DSH browser-trust fence is rejecting API calls. Add your tailnet DNS name to `trustedHosts` in your DSH web configuration. See `scripts/README-phone-access.md` in the DSH repo.
- **Bookmark unreachable** — Check that the trampoline service is running: `systemctl --user status dsh-web-redirect`
- **Cookie not set** — Verify that DSH is writing the web-launch-token file and that the plugin can read it

## License

MIT
