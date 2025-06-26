import { AxiosInstance } from 'axios';
import querystring from 'querystring';
import fs from 'fs';
import FormData from 'form-data';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export const tools = [
  {
    name: 'getListingsByShop',
    description: 'Get listings for a given shop',
    inputSchema: {
      type: 'object',
      properties: {
        shop_id: { type: 'string', description: 'The ID of the shop' },
        state: {
          type: 'string',
          description: 'The state of the listings to retrieve',
          enum: ['active', 'inactive', 'sold_out', 'draft', 'expired']
        }
      },
      required: ['shop_id']
    }
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
        when_made: {
          type: 'string',
          enum: [
            'made_to_order',
            '2020_2025',
            '2010_2019',
            '2006_2009',
            'before_2006',
            '2000_2005',
            '1990s',
            '1980s',
            '1970s',
            '1960s',
            '1950s',
            '1940s',
            '1930s',
            '1920s',
            '1910s',
            '1900s',
            '1800s',
            '1700s',
            'before_1700'
          ]
        },
        taxonomy_id: { type: 'number', description: 'The taxonomy ID of the listing' }
      },
      required: [
        'shop_id',
        'title',
        'description',
        'price',
        'quantity',
        'who_made',
        'when_made',
        'taxonomy_id'
      ]
    }
  },
  {
    name: 'uploadListingImage',
    description: 'Upload an image for a listing',
    inputSchema: {
      type: 'object',
      properties: {
        shop_id: { type: 'string', description: 'The ID of the shop' },
        listing_id: { type: 'string', description: 'The ID of the listing' },
        image_path: {
          type: 'string',
          description: 'Filesystem path to the image file to upload. The file must exist.'
        }
      },
      required: ['shop_id', 'listing_id', 'image_path']
    }
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
        price: { type: 'number', description: 'The new price of the listing' }
      },
      required: ['shop_id', 'listing_id']
    }
  },
  {
    name: 'getListingImages',
    description: 'Get images for a listing',
    inputSchema: {
      type: 'object',
      properties: {
        listing_id: { type: 'string', description: 'The ID of the listing' }
      },
      required: ['listing_id']
    }
  },
  {
    name: 'getListingFiles',
    description: 'Get files for a digital listing',
    inputSchema: {
      type: 'object',
      properties: {
        listing_id: { type: 'string', description: 'The ID of the listing' }
      },
      required: ['listing_id']
    }
  },
  {
    name: 'getListingInventory',
    description: 'Get inventory details for a listing',
    inputSchema: {
      type: 'object',
      properties: {
        listing_id: { type: 'string', description: 'The ID of the listing' }
      },
      required: ['listing_id']
    }
  },
  {
    name: 'updateListingInventory',
    description: 'Update inventory for a listing',
    inputSchema: {
      type: 'object',
      properties: {
        listing_id: { type: 'string', description: 'The ID of the listing' },
        products: { type: 'array', description: 'Inventory products' }
      },
      required: ['listing_id', 'products']
    }
  }
];

export const handlers: Record<string, (args: any, axios: AxiosInstance) => Promise<any>> = {
  getListingsByShop: async (args, axios) =>
    axios.get(`/application/shops/${args.shop_id}/listings`, { params: { state: args.state } }),

  createDraftListing: async (args, axios) => {
    const { shop_id, ...rest } = args as Record<string, any>;
    const payload = querystring.stringify(rest as any);
    return axios.post(`/application/shops/${shop_id}/listings`, payload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
  },

  uploadListingImage: async (args, axios) => {
    const { shop_id, listing_id, image_path } = args as {
      shop_id: string;
      listing_id: string;
      image_path: string;
    };
    if (!fs.existsSync(image_path)) {
      throw new McpError(ErrorCode.InvalidRequest, `File not found: ${image_path}`);
    }
    const form = new FormData();
    form.append('image', fs.createReadStream(image_path));
    return axios.post(`/application/shops/${shop_id}/listings/${listing_id}/images`, form, {
      headers: form.getHeaders()
    });
  },

  updateListing: async (args, axios) =>
    axios.patch(`/application/shops/${args.shop_id}/listings/${args.listing_id}`, args),

  getListingImages: async (args, axios) =>
    axios.get(`/application/listings/${args.listing_id}/images`),

  getListingFiles: async (args, axios) =>
    axios.get(`/application/listings/${args.listing_id}/files`),

  getListingInventory: async (args, axios) =>
    axios.get(`/application/listings/${args.listing_id}/inventory`),

  updateListingInventory: async (args, axios) =>
    axios.put(`/application/listings/${args.listing_id}/inventory`, { products: args.products })
};

