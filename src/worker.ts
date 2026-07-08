import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { ensureManifestsLoaded } from "./manifests.js";
import { createServer } from "./server.js";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, mcp-session-id, Last-Event-ID, mcp-protocol-version",
  "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version",
};

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
      return new Response(null, { headers: CORS_HEADERS });
    }

    // Ensure manifest data is available (no-op after first request in isolate)
    await ensureManifestsLoaded();

    try {
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

      await server.close();
      return corsResponse;
    } catch {
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  },
};
