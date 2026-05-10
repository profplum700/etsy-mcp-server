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
import { tools as referenceTools, handlers as referenceHandlers } from "./handlers/reference.js";
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
  MCP_BEARER?: string;
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
    ...referenceHandlers,
  };

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [...shopTools, ...listingTools, ...sellerTaxonomyTools, ...referenceTools],
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

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: jsonHeaders,
  });
}

function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < maxLength; index++) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return diff === 0;
}

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return null;
  }

  const [scheme, token, extra] = authorization.trim().split(/\s+/);
  if (scheme !== "Bearer" || !token || extra) {
    return null;
  }

  return token;
}

function isAuthorizedMcpRequest(request: Request, env: WorkerEnv): boolean {
  const expectedBearer = env.MCP_BEARER;
  const presentedBearer = getBearerToken(request);

  if (!expectedBearer || !presentedBearer) {
    return false;
  }

  return constantTimeEqual(presentedBearer, expectedBearer);
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

  if (!isAuthorizedMcpRequest(request, env)) {
    return unauthorized();
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
