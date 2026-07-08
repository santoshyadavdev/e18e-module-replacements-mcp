# Cloudflare Workers MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an HTTP transport entry point so the MCP server can be deployed to Cloudflare Workers and used via a remote HTTPS URL.

**Architecture:** Extract shared server creation into `src/server.ts`, keep stdio in `src/index.ts`, add Workers entry point in `src/worker.ts`. Manifests are loaded lazily per-isolate (Workers isolates persist across requests, so they're only fetched once per cold start). The `WebStandardStreamableHTTPServerTransport` from the MCP SDK handles the HTTP protocol.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk` (WebStandardStreamableHTTPServerTransport), Cloudflare Workers, Wrangler CLI

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/server.ts` | Create | Shared `createServer()` factory — creates McpServer, registers both tools |
| `src/index.ts` | Modify | Stdio entry point — imports `createServer()`, connects stdio transport |
| `src/worker.ts` | Create | Workers entry point — default fetch handler, creates transport per request |
| `src/manifests.ts` | Modify | Add `ensureManifestsLoaded()` for lazy loading in Workers (reuses existing module cache) |
| `wrangler.toml` | Create | Cloudflare Workers config |
| `tsup.config.ts` | Modify | Add worker entry point (no node shebang banner for worker build) |
| `package.json` | Modify | Add wrangler devDep, deploy/dev:worker scripts |

---

### Task 1: Extract shared server factory into `src/server.ts`

**Files:**
- Create: `src/server.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Create `src/server.ts` with the shared factory**

Extract all tool registration from `src/index.ts` into a reusable factory:

```typescript
// src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getNativeManifest,
  getMicroUtilitiesManifest,
  getPreferredManifest,
} from "./manifests.js";
import { lookupReplacement } from "./tools/lookup.js";
import { scanDependencies } from "./tools/scan.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "e18e-module-replacements",
    version: "1.0.0",
  });

  server.tool(
    "lookup_replacement",
    "Search for a JavaScript module or API replacement across native APIs, micro-utilities, and preferred module mappings from the e18e project",
    {
      name: z
        .string()
        .describe(
          "A feature name, API name, or module name to search for (e.g. 'axios', 'Array.from', 'deep-merge')",
        ),
    },
    async ({ name }) => {
      if (!getNativeManifest() && !getMicroUtilitiesManifest() && !getPreferredManifest()) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: manifest data failed to load. The server could not fetch replacement data from GitHub.",
            },
          ],
          isError: true,
        };
      }

      const results = lookupReplacement(name);

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No replacements found for "${name}".`,
            },
          ],
        };
      }

      const text = results
        .map((r) => {
          const parts = [`## ${r.id}`, `**Source:** ${r.source}`, `**Type:** ${r.type}`];
          if (r.description) parts.push(`**Description:** ${r.description}`);
          if (r.replacements)
            parts.push(`**Replacements:** ${r.replacements.join(", ")}`);
          if (r.url) parts.push(`**URL:** ${r.url}`);
          if (r.example) parts.push(`**Example:**\n\`\`\`js\n${r.example}\n\`\`\``);
          return parts.join("\n");
        })
        .join("\n\n---\n\n");

      return {
        content: [{ type: "text" as const, text }],
      };
    },
  );

  server.tool(
    "scan_dependencies",
    "Scan a list of dependencies (from package.json) and find which ones have recommended replacements from the e18e project",
    {
      dependencies: z
        .record(z.string(), z.string())
        .describe(
          "A map of package names to versions, like the dependencies field from package.json",
        ),
    },
    async ({ dependencies }) => {
      if (!getPreferredManifest()) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: preferred manifest failed to load. The server could not fetch replacement data from GitHub.",
            },
          ],
          isError: true,
        };
      }

      const results = scanDependencies(dependencies);

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No replacements found for the given dependencies. All good!",
            },
          ],
        };
      }

      const text = [
        `Found ${results.length} dependency replacement(s):\n`,
        ...results.map(
          (r) =>
            `- **${r.dependency}** → ${r.replacements.join(", ")}\n  ${r.url}`,
        ),
      ].join("\n");

      return {
        content: [{ type: "text" as const, text }],
      };
    },
  );

  return server;
}
```

- [ ] **Step 2: Simplify `src/index.ts` to use the factory**

Replace the entire file with:

```typescript
// src/index.ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadManifests } from "./manifests.js";
import { createServer } from "./server.js";

async function main() {
  await loadManifests();
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("e18e module replacements MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

- [ ] **Step 3: Build and verify stdio still works**

Run: `npm run build`
Expected: Build succeeds with no errors, `dist/index.js` is produced.

- [ ] **Step 4: Commit**

```bash
git add src/server.ts src/index.ts
git commit -m "refactor: extract shared server factory into server.ts"
```

---

### Task 2: Add `ensureManifestsLoaded()` to manifests module

**Files:**
- Modify: `src/manifests.ts`

Workers isolates persist module-level state across requests within the same isolate. We add a lazy-loading function that only fetches if manifests haven't been loaded yet.

- [ ] **Step 1: Add `ensureManifestsLoaded()` function to `src/manifests.ts`**

Add this function after the existing `loadManifests()` function (keep all existing code unchanged):

```typescript
/**
 * Lazy-load manifests if not already cached in module scope.
 * Workers isolates persist module state across requests,
 * so this only fetches on cold start.
 */
export async function ensureManifestsLoaded(): Promise<void> {
  if (nativeManifest || microUtilitiesManifest || preferredManifest) {
    return;
  }
  await loadManifests();
}
```

- [ ] **Step 2: Build to verify no regressions**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/manifests.ts
git commit -m "feat: add ensureManifestsLoaded for lazy loading in Workers"
```

---

### Task 3: Create the Cloudflare Workers entry point

**Files:**
- Create: `src/worker.ts`

- [ ] **Step 1: Create `src/worker.ts`**

```typescript
// src/worker.ts
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { ensureManifestsLoaded } from "./manifests.js";
import { createServer } from "./server.js";

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Health check / info endpoint
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          name: "e18e-module-replacements",
          version: "1.0.0",
          status: "ok",
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Only handle /mcp path
    if (url.pathname !== "/mcp") {
      return new Response("Not Found", { status: 404 });
    }

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type, mcp-session-id, Last-Event-ID, mcp-protocol-version",
          "Access-Control-Expose-Headers":
            "mcp-session-id, mcp-protocol-version",
        },
      });
    }

    // Ensure manifest data is available
    await ensureManifestsLoaded();

    // Create a fresh transport + server per request (stateless mode)
    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
    });
    const server = createServer();
    await server.connect(transport);

    const response = await transport.handleRequest(request);

    // Add CORS headers to the response
    const corsResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
    corsResponse.headers.set("Access-Control-Allow-Origin", "*");
    corsResponse.headers.set(
      "Access-Control-Expose-Headers",
      "mcp-session-id, mcp-protocol-version",
    );

    return corsResponse;
  },
};
```

- [ ] **Step 2: Build to verify the file compiles**

Run: `npm run build`
Expected: Build succeeds (worker.ts won't be in the tsup config yet, but TypeScript should still check it).

- [ ] **Step 3: Commit**

```bash
git add src/worker.ts
git commit -m "feat: add Cloudflare Workers entry point with HTTP transport"
```

---

### Task 4: Configure Wrangler and build tooling

**Files:**
- Create: `wrangler.toml`
- Modify: `tsup.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Create `wrangler.toml`**

```toml
name = "e18e-module-replacements-mcp"
main = "src/worker.ts"
compatibility_date = "2026-07-01"
compatibility_flags = ["nodejs_compat"]
```

- [ ] **Step 2: Update `tsup.config.ts` to build both entry points**

Replace the entire file with:

```typescript
import { defineConfig } from "tsup";

export default defineConfig([
  // Stdio entry point (Node.js CLI)
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    target: "node18",
    outDir: "dist",
    clean: true,
    sourcemap: true,
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
]);
```

Note: The worker entry point is built by `wrangler` directly (it has its own bundler), so we do NOT add `src/worker.ts` to tsup. The tsup config stays focused on the stdio CLI build only.

- [ ] **Step 3: Update `package.json` — add wrangler and scripts**

Add `wrangler` to devDependencies and add worker-related scripts:

In `package.json`, update the `"scripts"` section to:

```json
{
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "dev:worker": "wrangler dev",
    "deploy": "wrangler deploy",
    "prepublishOnly": "npm run build"
  }
}
```

Add to `"devDependencies"`:

```json
{
  "wrangler": "^4.0.0"
}
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: wrangler is installed successfully.

- [ ] **Step 5: Build stdio entry to verify no regressions**

Run: `npm run build`
Expected: Build succeeds, `dist/index.js` is produced with the shebang banner.

- [ ] **Step 6: Commit**

```bash
git add wrangler.toml tsup.config.ts package.json package-lock.json
git commit -m "feat: add wrangler config and deploy scripts"
```

---

### Task 5: Test the Workers dev server locally

**Files:** None (verification only)

- [ ] **Step 1: Start the wrangler dev server**

Run: `npx wrangler dev`
Expected: Server starts on `http://localhost:8787` (or similar port). You should see output like:
```
Ready on http://localhost:8787
```

- [ ] **Step 2: Test the health endpoint**

Run: `curl http://localhost:8787/`
Expected:
```json
{"name":"e18e-module-replacements","version":"1.0.0","status":"ok"}
```

- [ ] **Step 3: Test the MCP endpoint with a valid initialize request**

Run:
```bash
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": {},
      "clientInfo": { "name": "test-client", "version": "1.0.0" }
    }
  }'
```

Expected: A JSON-RPC response with the server's capabilities, including the two tools.

- [ ] **Step 4: Stop the dev server**

Press Ctrl+C or stop the process.

- [ ] **Step 5: Verify stdio still works**

Run: `echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node dist/index.js`

Expected: A JSON-RPC initialize response on stdout (the server sends the response then waits for more input).

---

### Task 6: Update README with deployment instructions

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add Workers deployment section to README.md**

Add a new section after the existing usage instructions:

```markdown
## Remote Server (Cloudflare Workers)

This MCP server can also be deployed as a remote HTTP server on Cloudflare Workers.

### Local Development

```bash
npm run dev:worker
```

The server starts at `http://localhost:8787/mcp`.

### Deploy

```bash
# First time: authenticate with Cloudflare
npx wrangler login

# Deploy to Workers
npm run deploy
```

Your server will be available at `https://e18e-module-replacements-mcp.<your-account>.workers.dev/mcp`.

### Add to GitHub Copilot

1. Go to your GitHub organization/repo settings → Copilot → MCP Servers
2. Click "Add MCP Server"
3. **Label:** `e18e-module-replacements`
4. **Server URL:** `https://e18e-module-replacements-mcp.<your-account>.workers.dev/mcp`
5. **Authentication:** None
6. Click "Connect"
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add Cloudflare Workers deployment instructions"
```
