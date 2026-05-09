import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { tools as shopTools, handlers as shopHandlers } from "./handlers/shop.js";
import { tools as listingTools, handlers as listingHandlers } from "./handlers/listing.js";
import {
  tools as sellerTaxonomyTools,
  handlers as sellerTaxonomyHandlers,
} from "./handlers/seller-taxonomy.js";
import {
  createEtsyApiClient,
  formatEtsyFailure,
  type EtsyMcpApiClient,
} from "./etsy-api-client.js";
import type { ToolHandler } from "./index.js";

export interface WorkerEnv {
  ETSY_API_KEY?: string;
  ETSY_SHARED_SECRET?: string;
  ETSY_REFRESH_TOKEN?: string;
  MCP_ENDPOINT?: string;
}

const DEFAULT_MCP_ENDPOINT = "/mcp";
const HEALTH_ENDPOINT = "/healthz";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function createWorkerApiClient(env: WorkerEnv): EtsyMcpApiClient {
  return createEtsyApiClient({
    apiKey: env.ETSY_API_KEY ?? "",
    sharedSecret: env.ETSY_SHARED_SECRET ?? "",
    refreshToken: env.ETSY_REFRESH_TOKEN ?? "",
  });
}

function createWorkerServer(apiClient: EtsyMcpApiClient): Server {
  const server = new Server(
    {
      name: "etsy-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    }
  );

  const handlers: Record<string, ToolHandler> = {
    ...shopHandlers,
    ...listingHandlers,
    ...sellerTaxonomyHandlers,
  };

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [...shopTools, ...listingTools, ...sellerTaxonomyTools],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (!request.params.arguments) {
      throw new McpError(ErrorCode.InvalidRequest, "Arguments are required");
    }

    const handler = handlers[request.params.name];
    if (!handler) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
    }

    try {
      const response = await handler(request.params.arguments, apiClient);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      return {
        content: [
          {
            type: "text",
            text: formatEtsyFailure(error),
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

function notFound(): Response {
  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: jsonHeaders,
  });
}

function healthResponse(endpoint: string): Response {
  return new Response(
    JSON.stringify({
      ok: true,
      name: "etsy-mcp-server",
      transport: "streamable-http",
      endpoint,
    }),
    { headers: jsonHeaders }
  );
}

export async function handleWorkerRequest(request: Request, env: WorkerEnv): Promise<Response> {
  const url = new URL(request.url);
  const mcpEndpoint = env.MCP_ENDPOINT || DEFAULT_MCP_ENDPOINT;

  if (request.method === "GET" && url.pathname === HEALTH_ENDPOINT) {
    return healthResponse(mcpEndpoint);
  }

  if (url.pathname !== mcpEndpoint) {
    return notFound();
  }

  const apiClient = createWorkerApiClient(env);
  const server = createWorkerServer(apiClient);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  return transport.handleRequest(request);
}

export default {
  fetch(request: Request, env: WorkerEnv): Promise<Response> {
    return handleWorkerRequest(request, env);
  },
};
