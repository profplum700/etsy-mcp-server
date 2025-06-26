#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import { loadEtsyConfig } from './config.js';

const {
  apiKey: API_KEY,
  sharedSecret: SHARED_SECRET,
  refreshToken: REFRESH_TOKEN,
} = loadEtsyConfig();

class EtsyServer {
  private server: Server;
  private axiosInstance;
  private accessToken: string | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'etsy-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.axiosInstance = axios.create({
      baseURL: 'https://api.etsy.com/v3',
    });

    this.setupToolHandlers();
    
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private async refreshAccessToken() {
    try {
      const response = await axios.post('https://api.etsy.com/v3/public/oauth/token', {
        grant_type: 'refresh_token',
        client_id: API_KEY,
        refresh_token: REFRESH_TOKEN,
      });
      this.accessToken = response.data.access_token;
      this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
      this.axiosInstance.defaults.headers.common['x-api-key'] = API_KEY as string;
    } catch (error: any) {
      console.error('Error refreshing access token:', error.response ? error.response.data : error.message);
      throw new McpError(ErrorCode.InternalError, 'Failed to refresh Etsy access token');
    }
  }

  private async ensureAccessToken() {
    if (!this.accessToken) {
      await this.refreshAccessToken();
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'getShop',
          description: 'Get shop information',
          inputSchema: {
            type: 'object',
            properties: {
              shop_id: { type: 'string', description: 'The ID of the shop to retrieve' },
            },
            required: ['shop_id'],
          },
        },
        {
          name: 'getMe',
          description: 'Get info about the authenticated user',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
            name: 'getListingsByShop',
            description: 'Get listings for a given shop',
            inputSchema: {
                type: 'object',
                properties: {
                    shop_id: { type: 'string', description: 'The ID of the shop' },
                    state: { type: 'string', description: 'The state of the listings to retrieve', enum: ['active', 'inactive', 'sold_out', 'draft', 'expired'] }
                },
                required: ['shop_id'],
            },
        },
        {
            name: 'createDraftListing',
            description: 'Create a new draft listing',
            inputSchema: {
                type: 'object',
                properties: {
                    shop_id: { type: 'string', description: 'The ID of the shop' },
                    title: { type: 'string', description: 'The title of the listing' },
                    description: { type: 'string', description: 'The description of the listing' },
                    price: { type: 'number', description: 'The price of the listing' },
                    quantity: { type: 'number', description: 'The quantity of the listing' },
                    who_made: { type: 'string', enum: ['i_did', 'someone_else', 'collective'] },
                    when_made: { type: 'string', enum: ['made_to_order', '2020_2025', '2010_2019', '2006_2009', 'before_2006', '2000_2005', '1990s', '1980s', '1970s', '1960s', '1950s', '1940s', '1930s', '1920s', '1910s', '1900s', '1800s', '1700s', 'before_1700'] },
                    taxonomy_id: { type: 'number', description: 'The taxonomy ID of the listing' },
                },
                required: ['shop_id', 'title', 'description', 'price', 'quantity', 'who_made', 'when_made', 'taxonomy_id'],
            },
        },
        {
            name: 'uploadListingImage',
            description: 'Upload an image for a listing',
            inputSchema: {
                type: 'object',
                properties: {
                    shop_id: { type: 'string', description: 'The ID of the shop' },
                    listing_id: { type: 'string', description: 'The ID of the listing' },
                    image_path: { type: 'string', description: 'The path to the image to upload' },
                },
                required: ['shop_id', 'listing_id', 'image_path'],
            },
        },
        {
            name: 'updateListing',
            description: 'Update an existing listing',
            inputSchema: {
                type: 'object',
                properties: {
                    shop_id: { type: 'string', description: 'The ID of the shop' },
                    listing_id: { type: 'string', description: 'The ID of the listing' },
                    title: { type: 'string', description: 'The new title of the listing' },
                    description: { type: 'string', description: 'The new description of the listing' },
                    price: { type: 'number', description: 'The new price of the listing' },
                },
                required: ['shop_id', 'listing_id'],
            },
        },
        {
            name: 'getShopReceipts',
            description: 'Get shop receipts',
            inputSchema: {
                type: 'object',
                properties: {
                    shop_id: { type: 'string', description: 'The ID of the shop' },
                },
                required: ['shop_id'],
            },
        },
        {
            name: 'getListingImages',
            description: 'Get images for a listing',
            inputSchema: {
                type: 'object',
                properties: {
                    listing_id: { type: 'string', description: 'The ID of the listing' },
                },
                required: ['listing_id'],
            },
        },
        {
            name: 'getListingFiles',
            description: 'Get files for a digital listing',
            inputSchema: {
                type: 'object',
                properties: {
                    listing_id: { type: 'string', description: 'The ID of the listing' },
                },
                required: ['listing_id'],
            },
        },
        {
            name: 'getListingInventory',
            description: 'Get inventory details for a listing',
            inputSchema: {
                type: 'object',
                properties: {
                    listing_id: { type: 'string', description: 'The ID of the listing' },
                },
                required: ['listing_id'],
            },
        },
        {
            name: 'updateListingInventory',
            description: 'Update inventory for a listing',
            inputSchema: {
                type: 'object',
                properties: {
                    listing_id: { type: 'string', description: 'The ID of the listing' },
                    products: { type: 'array', description: 'Inventory products' },
                },
                required: ['listing_id', 'products'],
            },
        },
        {
            name: 'getShopPolicies',
            description: 'Get shop policies',
            inputSchema: {
                type: 'object',
                properties: {
                    shop_id: { type: 'string', description: 'The ID of the shop' },
                },
                required: ['shop_id'],
            },
        }
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      await this.ensureAccessToken();
      if (!request.params.arguments) {
        throw new McpError(ErrorCode.InvalidRequest, 'Arguments are required');
      }
      try {
        let response;
        switch (request.params.name) {
          case 'getShop':
            response = await this.axiosInstance.get(`/application/shops/${request.params.arguments.shop_id}`);
            break;
          case 'getMe':
            response = await this.axiosInstance.get('/application/users/me');
            break;
          case 'getListingsByShop':
            response = await this.axiosInstance.get(`/application/shops/${request.params.arguments.shop_id}/listings`, { params: { state: request.params.arguments.state } });
            break;
          case 'createDraftListing':
            response = await this.axiosInstance.post(`/application/shops/${request.params.arguments.shop_id}/listings`, request.params.arguments);
            break;
          case 'uploadListingImage':
            // This is a placeholder. Actual implementation would require reading the file and sending it as multipart/form-data
            response = { data: { success: true, message: "Image upload placeholder" } };
            break;
          case 'updateListing':
            response = await this.axiosInstance.patch(`/application/shops/${request.params.arguments.shop_id}/listings/${request.params.arguments.listing_id}`, request.params.arguments);
            break;
          case 'getShopReceipts':
            response = await this.axiosInstance.get(`/application/shops/${request.params.arguments.shop_id}/receipts`);
            break;
          case 'getListingImages':
            response = await this.axiosInstance.get(`/application/listings/${request.params.arguments.listing_id}/images`);
            break;
          case 'getListingFiles':
            response = await this.axiosInstance.get(`/application/listings/${request.params.arguments.listing_id}/files`);
            break;
          case 'getListingInventory':
            response = await this.axiosInstance.get(`/application/listings/${request.params.arguments.listing_id}/inventory`);
            break;
          case 'updateListingInventory':
            response = await this.axiosInstance.put(`/application/listings/${request.params.arguments.listing_id}/inventory`, { products: request.params.arguments.products });
            break;
          case 'getShopPolicies':
            response = await this.axiosInstance.get(`/application/shops/${request.params.arguments.shop_id}/policies`);
            break;
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
        };
      } catch (error: any) {
        if (axios.isAxiosError(error)) {
          return {
            content: [{ type: 'text', text: `Etsy API error: ${error.response?.data.message ?? error.message}` }],
            isError: true,
          };
        }
        throw error;
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Etsy MCP server running on stdio');
  }
}

const server = new EtsyServer();
server.run().catch(console.error);
