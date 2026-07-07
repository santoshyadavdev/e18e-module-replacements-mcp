# e18e Module Replacements MCP Server

An MCP (Model Context Protocol) server that exposes [e18e](https://e18e.dev) module replacement data. It helps AI assistants suggest lighter, faster, or native alternatives to common JavaScript/Node.js packages.

## What it does

The server fetches three manifests from the [e18e/module-replacements](https://github.com/e18e/module-replacements) repository at startup:

- **native.json** — JavaScript features replaceable by native APIs (e.g., `Array.from`, `AbortController`)
- **micro-utilities.json** — Code snippets that replace tiny npm packages
- **preferred.json** — Module-to-module replacement mappings (e.g., `axios` → `fetch`/`ofetch`/`ky`)

## Tools

### `lookup_replacement`

Search for a replacement by name across all three manifests.

**Input:**
```json
{ "name": "axios" }
```

**Output:**
```
## axios
**Source:** preferred
**Type:** module
**Replacements:** fetch, ofetch, ky
**URL:** https://e18e.dev/guide/module-replacements/fetch
```

### `scan_dependencies`

Scan a dependency map (like `dependencies` from `package.json`) for packages that have recommended replacements.

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

**Output:**
```
Found 3 dependency replacement(s):

- **axios** → fetch, ofetch, ky
  https://e18e.dev/guide/module-replacements/fetch
- **chalk** → picocolors, ansis
  https://e18e.dev/guide/module-replacements/chalk
- **lodash** → es-toolkit
  https://e18e.dev/guide/module-replacements/lodash
```

## Installation

```bash
git clone https://github.com/santoshyadavdev/e18e-module-replacements-mcp.git
cd e18e-module-replacements-mcp
npm install
npm run build
```

## MCP Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

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

### VS Code (GitHub Copilot)

Add to your `.vscode/mcp.json` or user settings:

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

## Development

```bash
npm run dev   # Watch mode with tsup
```

## License

MIT
