# Cloudflare Workers MCP Server — Design Spec

**Date:** 2026-07-08
**Status:** Draft
**Author:** Santosh Yadav (with Copilot)

## Goal

Expose the existing e18e module replacements MCP server as a remote HTTP-based MCP server deployed on Cloudflare Workers, so it can be used via the GitHub Copilot "Add MCP Server" dialog (which requires an HTTPS URL).

## Constraints

- Keep the existing stdio transport for local CLI usage
- No authentication — this serves public, read-only e18e data
- Stateless deployment on Cloudflare Workers (free tier)
- Must support the MCP Streamable HTTP transport protocol

## Architecture

### Entry Points

Two entry points share the same server logic:

1. **`src/index.ts`** — stdio transport (existing, for local use via `npx` or direct invocation)
2. **`src/worker.ts`** — Cloudflare Workers `fetch` handler using `StreamableHTTPServerTransport`

### Shared Server Factory

A new `src/server.ts` extracts the `McpServer` creation and tool registration into a reusable factory function:

```typescript
export function createServer(): McpServer {
  const server = new McpServer({ name: "e18e-module-replacements", version: "1.0.0" });
  // Register lookup_replacement and scan_dependencies tools
  return server;
}
```

Both `index.ts` and `worker.ts` call `createServer()` and attach their respective transports.

### Manifest Loading Strategy

- **Stdio (`index.ts`):** Load manifests once at startup via `loadManifests()` (current behavior). Works because stdio is a long-running process.
- **Workers (`worker.ts`):** Uses `ensureManifestsLoaded()` which checks all three module-level manifest variables (`&&` guard). Workers isolates persist module-level state across requests within the same isolate, so manifests are only fetched on cold start — no Cache API needed.

The `manifests.ts` module is updated to support both modes:
- The existing `loadManifests()` function stays for stdio (eager, module-level cache)
- A new `ensureManifestsLoaded()` function is added for Workers (skips fetch if all three manifests are already loaded, retries if any failed)

### Workers Request Handling

`worker.ts` handles the MCP Streamable HTTP protocol:

- **`POST /mcp`** — Main MCP endpoint. Creates a `StreamableHTTPServerTransport`, connects it to the server, handles the request/response.
- **`GET /mcp`** — SSE endpoint for server-to-client notifications (if needed by the transport).
- **`DELETE /mcp`** — Session cleanup.
- **`GET /`** — Health check / info endpoint returning server name and version.

### File Changes

| File | Change |
|------|--------|
| `src/server.ts` | **NEW** — Shared `createServer()` factory with all tool registrations |
| `src/index.ts` | **MODIFIED** — Import `createServer()` from `server.ts`, keep stdio transport |
| `src/worker.ts` | **NEW** — Cloudflare Workers entry point with `StreamableHTTPServerTransport` |
| `src/manifests.ts` | **MODIFIED** — Add `ensureManifestsLoaded()` for lazy loading in Workers (reuses module-level cache) |
| `wrangler.toml` | **NEW** — Cloudflare Workers configuration |
| `tsup.config.ts` | **MODIFIED** — Convert to array config (stdio-only — worker is built by Wrangler's bundler) |
| `package.json` | **MODIFIED** — Add `wrangler` dev dependency and deploy script |

### Deployment

```bash
# Install wrangler
npm install -D wrangler

# Local development
npx wrangler dev

# Deploy
npx wrangler deploy
```

The deployed URL (e.g., `https://e18e-module-replacements-mcp.<account>.workers.dev/mcp`) is what goes into the GitHub Copilot "Add MCP Server" dialog.

### wrangler.toml

```toml
name = "e18e-module-replacements-mcp"
main = "src/worker.ts"
compatibility_date = "2026-07-01"
compatibility_flags = ["nodejs_compat"]
```

## What's NOT Included

- No authentication (public data, can be added later)
- No rate limiting (Cloudflare's built-in protections apply)
- No custom domain (uses `*.workers.dev` subdomain; can be added later)
- No KV/D1 storage (manifests cached in module-level variables within Workers isolates)

## Success Criteria

1. `npm run build` produces the stdio entry point (`dist/index.js`); Wrangler builds the worker separately
2. `npx wrangler dev` runs the server locally and responds to MCP requests
3. `npx wrangler deploy` deploys to Cloudflare Workers
4. The deployed URL works in GitHub Copilot's "Add MCP Server" dialog with "None" auth
5. Both `lookup_replacement` and `scan_dependencies` tools work via the remote server
6. Existing stdio transport continues to work unchanged
