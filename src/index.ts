#!/usr/bin/env node
import { fileURLToPath } from "url";
import path from "path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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
import { loadEtsyConfig } from "./config.js";
import {
  createEtsyApiClient,
  formatEtsyFailure,
  type EtsyMcpApiClient,
} from "./etsy-api-client.js";

export type ToolHandler = (args: unknown, client: EtsyMcpApiClient) => Promise<unknown>;

export interface EtsyServerOptions {
  apiClient?: EtsyMcpApiClient;
}

function createConfiguredApiClient(): EtsyMcpApiClient {
  const { apiKey, sharedSecret, refreshToken } = loadEtsyConfig();
  return createEtsyApiClient({ apiKey, sharedSecret, refreshToken });
}

export class EtsyServer {
  private server: Server;
  private etsyClient: EtsyMcpApiClient;
  private handlers: Record<string, ToolHandler>;

  constructor(options: EtsyServerOptions = {}) {
    this.server = new Server(
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

    this.etsyClient = options.apiClient ?? createConfiguredApiClient();
    this.handlers = {
      ...shopHandlers,
      ...listingHandlers,
      ...sellerTaxonomyHandlers,
      ...referenceHandlers,
    };

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async listTools() {
    return [...shopTools, ...listingTools, ...sellerTaxonomyTools, ...referenceTools];
  }

  async callTool(name: string, args: unknown) {
    if (!args) {
      throw new McpError(ErrorCode.InvalidRequest, "Arguments are required");
    }

    const handler = this.handlers[name];
    if (!handler) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }

    try {
      const response = await handler(args, this.etsyClient);
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
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: await this.listTools(),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) =>
      this.callTool(request.params.name, request.params.arguments)
    );
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Etsy MCP server running on stdio");
  }
}

const scriptPath = fileURLToPath(import.meta.url);
const argvPath = path.resolve(process.argv[1] || "");
const argvPathWithTs = argvPath + ".ts";
const isMain = argvPath === scriptPath || argvPathWithTs === scriptPath;

if (isMain) {
  const server = new EtsyServer();
  server.run().catch((error) => {
    console.error("Failed to start Etsy MCP server", formatEtsyFailure(error));
    process.exit(1);
  });
}
