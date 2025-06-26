import { AxiosInstance } from 'axios';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export const tools = [
  {
    name: 'getShop',
    description: 'Get shop information',
    inputSchema: {
      type: 'object',
      properties: {
        shop_id: { type: 'string', description: 'The ID of the shop to retrieve' }
      },
      required: ['shop_id']
    }
  },
  {
    name: 'getMe',
    description: 'Get info about the authenticated user',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'getShopReceipts',
    description: 'Get shop receipts',
    inputSchema: {
      type: 'object',
      properties: {
        shop_id: { type: 'string', description: 'The ID of the shop' }
      },
      required: ['shop_id']
    }
  },
  {
    name: 'getShopSections',
    description: 'Get sections for a shop',
    inputSchema: {
      type: 'object',
      properties: {
        shop_id: { type: 'string', description: 'The ID of the shop' }
      },
      required: ['shop_id']
    }
  },
  {
    name: 'getShopSection',
    description: 'Get a single shop section',
    inputSchema: {
      type: 'object',
      properties: {
        shop_id: { type: 'string', description: 'The ID of the shop' },
        shop_section_id: { type: 'string', description: 'The ID of the shop section' }
      },
      required: ['shop_id', 'shop_section_id']
    }
  }
];

export const handlers: Record<string, (args: any, axios: AxiosInstance) => Promise<any>> = {
  getShop: async (args, axios) => axios.get(`/application/shops/${args.shop_id}`),
  getMe: async (_args, axios) => axios.get('/application/users/me'),
  getShopReceipts: async (args, axios) => axios.get(`/application/shops/${args.shop_id}/receipts`),
  getShopSections: async (args, axios) => axios.get(`/application/shops/${args.shop_id}/sections`),
  getShopSection: async (args, axios) =>
    axios.get(`/application/shops/${args.shop_id}/sections/${args.shop_section_id}`)
};
