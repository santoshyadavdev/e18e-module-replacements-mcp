import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadManifests } from "./manifests.js";
import { lookupReplacement } from "./tools/lookup.js";
import { scanDependencies } from "./tools/scan.js";

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

async function main() {
  await loadManifests();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("e18e module replacements MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
