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
