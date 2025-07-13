#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosInstance, AxiosResponse } from "axios";
import { tools as shopTools, handlers as shopHandlers } from "./handlers/shop.js";
import { tools as listingTools, handlers as listingHandlers } from "./handlers/listing.js";
import {
  tools as sellerTaxonomyTools,
  handlers as sellerTaxonomyHandlers,
} from "./handlers/seller-taxonomy.js";
import { loadEtsyConfig } from "./config.js";

const { apiKey: API_KEY, refreshToken: REFRESH_TOKEN } = loadEtsyConfig();

class EtsyServer {
  private server: Server;
  private axiosInstance: AxiosInstance;
  private accessToken: string | null = null;

  constructor() {
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

    this.axiosInstance = axios.create({
      baseURL: "https://api.etsy.com/v3",
    });

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private async refreshAccessToken() {
    try {
      const response = await axios.post("https://api.etsy.com/v3/public/oauth/token", {
        grant_type: "refresh_token",
        client_id: API_KEY,
        refresh_token: REFRESH_TOKEN,
      });
      this.accessToken = response.data.access_token;
      this.axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${this.accessToken}`;
      this.axiosInstance.defaults.headers.common["x-api-key"] = API_KEY as string;
    } catch (error: unknown) {
      console.error(
        "Error refreshing access token:",
        error instanceof Error && "response" in error
          ? (error as { response?: { data: unknown } }).response?.data
          : error instanceof Error
            ? error.message
            : String(error)
      );
      throw new McpError(ErrorCode.InternalError, "Failed to refresh Etsy access token");
    }
  }

  private async ensureAccessToken() {
    if (!this.accessToken) {
      await this.refreshAccessToken();
    }
  }

  private setupToolHandlers() {
    const allTools = [...shopTools, ...listingTools, ...sellerTaxonomyTools];
    const handlers = {
      ...shopHandlers,
      ...listingHandlers,
      ...sellerTaxonomyHandlers,
    } as Record<string, (args: unknown, axios: AxiosInstance) => Promise<unknown>>;

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: allTools,
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      await this.ensureAccessToken();
      if (!request.params.arguments) {
        throw new McpError(ErrorCode.InvalidRequest, "Arguments are required");
      }
      try {
        const handler = handlers[request.params.name];
        if (!handler) {
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
        }
        const response = await handler(request.params.arguments, this.axiosInstance);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify((response as AxiosResponse).data, null, 2),
            },
          ],
        };
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          return {
            content: [
              {
                type: "text",
                text: `Etsy API error: ${error.response?.data.message ?? error.message}`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Etsy MCP server running on stdio");
  }
}

const server = new EtsyServer();
server.run().catch(console.error);
