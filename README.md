# e18e Module Replacements MCP Server

An [MCP](https://modelcontextprotocol.io) (Model Context Protocol) server that exposes [e18e](https://e18e.dev) module replacement data. It helps AI assistants suggest lighter, faster, or native alternatives to common JavaScript/Node.js packages.

## What it does

The [e18e](https://e18e.dev) project ("ecosystem performance") maintains curated lists of JavaScript module replacements — lighter alternatives, native API equivalents, and simple code snippets that can eliminate unnecessary dependencies.

This MCP server fetches three manifests from the [e18e/module-replacements](https://github.com/e18e/module-replacements) repository at startup and exposes them as tools:

| Manifest | Description | Example |
|----------|-------------|---------|
| **native.json** | Features replaceable by native browser/Node.js APIs | `is-array` → `Array.isArray()` |
| **micro-utilities.json** | Tiny packages replaceable by code snippets | `array-flatten` → `array.flat(Infinity)` |
| **preferred.json** | Modules with better, lighter alternatives | `axios` → `fetch` / `ofetch` / `ky` |

## Prerequisites

- [Node.js](https://nodejs.org) >= 18

## Installation

### 1. Clone and build

```bash
git clone https://github.com/santoshyadavdev/e18e-module-replacements-mcp.git
cd e18e-module-replacements-mcp
npm install
npm run build
```

### 2. Verify the build

```bash
node dist/index.js
# You should see "e18e module replacements MCP server running on stdio" on stderr
# Press Ctrl+C to exit
```

## Configuration

After building, add the server to your AI assistant's MCP configuration. Replace `/absolute/path/to` with the actual path where you cloned the repo.

### Claude Desktop

Open your Claude Desktop config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add the server entry:

```json
{
  "mcpServers": {
    "e18e-module-replacements": {
      "command": "node",
      "args": ["/absolute/path/to/e18e-module-replacements-mcp/dist/index.js"]
    }
  }
}
```

Then restart Claude Desktop.

### VS Code (GitHub Copilot)

Create or edit `.vscode/mcp.json` in your workspace (or add to your user settings):

```json
{
  "servers": {
    "e18e-module-replacements": {
      "command": "node",
      "args": ["/absolute/path/to/e18e-module-replacements-mcp/dist/index.js"]
    }
  }
}
```

### Cursor

Open **Cursor Settings → MCP** and add a new server:

- **Name:** `e18e-module-replacements`
- **Type:** `command`
- **Command:** `node /absolute/path/to/e18e-module-replacements-mcp/dist/index.js`

### Windsurf

Add to your `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "e18e-module-replacements": {
      "command": "node",
      "args": ["/absolute/path/to/e18e-module-replacements-mcp/dist/index.js"]
    }
  }
}
```

## Tools

### `lookup_replacement`

Search for a replacement by feature name, API name, or module name. Searches across all three manifests with case-insensitive partial matching.

**Input:**

```json
{ "name": "axios" }
```

**Example output:**

```
## axios
**Source:** preferred
**Type:** module
**Replacements:** fetch, ofetch, ky
**URL:** https://e18e.dev/guide/module-replacements/fetch
```

**More examples:**

| Query | What you get |
|-------|-------------|
| `"axios"` | Preferred replacements: `fetch`, `ofetch`, `ky` |
| `"Array.from"` | Native API — link to MDN docs |
| `"deep-merge"` | Preferred replacements: `defu`, `@fastify/deepmerge` |
| `"array-flatten"` | Micro-utility snippet: `array.flat(Infinity)` |

### `scan_dependencies`

Scan a dependency map (like the `dependencies` field from `package.json`) and find which packages have recommended replacements.

**Input:**

```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "chalk": "^5.3.0",
    "express": "^4.18.0",
    "lodash": "^4.17.21"
  }
}
```

**Example output:**

```
Found 3 dependency replacement(s):

- **axios** → fetch, ofetch, ky
  https://e18e.dev/guide/module-replacements/fetch
- **chalk** → picocolors, ansis
  https://e18e.dev/guide/module-replacements/chalk
- **lodash** → es-toolkit
  https://e18e.dev/guide/module-replacements/lodash
```

## Usage tips

Once the MCP server is connected to your AI assistant, you can ask things like:

- *"Is there a lighter alternative to chalk?"*
- *"Scan my package.json dependencies for replacements"*
- *"What's the native replacement for is-array?"*
- *"Can I replace moment with something smaller?"*

The AI assistant will automatically use the `lookup_replacement` and `scan_dependencies` tools to answer.

## Development

```bash
npm run dev   # Watch mode — rebuilds on file changes
```

## How it works

1. On startup, the server fetches all three e18e manifests from GitHub
2. Manifests are cached in memory for the lifetime of the server process
3. The server communicates over **stdio** using the MCP protocol
4. If a manifest fails to load (e.g., no internet), the server still starts — tools will return an error message for the missing data source

## License

MIT
