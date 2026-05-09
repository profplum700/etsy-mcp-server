import type { EtsyMcpApiClient } from "../etsy-api-client.js";

export const tools = [
  {
    name: "getListingsByShop",
    description: "Get listings for a given shop",
    inputSchema: {
      type: "object",
      properties: {
        shop_id: { type: "string", description: "The ID of the shop" },
        state: {
          type: "string",
          description: "The state of the listings to retrieve",
          enum: ["active", "inactive", "sold_out", "draft", "expired"],
        },
      },
      required: ["shop_id"],
    },
  },
  {
    name: "getListingImages",
    description: "Get images for a listing",
    inputSchema: {
      type: "object",
      properties: {
        listing_id: { type: "string", description: "The ID of the listing" },
      },
      required: ["listing_id"],
    },
  },
  {
    name: "getListingFiles",
    description: "Get files for a digital listing",
    inputSchema: {
      type: "object",
      properties: {
        listing_id: { type: "string", description: "The ID of the listing" },
      },
      required: ["listing_id"],
    },
  },
  {
    name: "getListingInventory",
    description: "Get inventory details for a listing",
    inputSchema: {
      type: "object",
      properties: {
        listing_id: { type: "string", description: "The ID of the listing" },
      },
      required: ["listing_id"],
    },
  },
];

interface GetListingsByShopArgs {
  shop_id: string;
  state?: string;
}

interface GetListingImagesArgs {
  listing_id: string;
}

interface GetListingFilesArgs {
  listing_id: string;
}

interface GetListingInventoryArgs {
  listing_id: string;
}

export const handlers: Record<
  string,
  (args: unknown, client: EtsyMcpApiClient) => Promise<unknown>
> = {
  getListingsByShop: async (args, client) => {
    const { shop_id, state } = args as GetListingsByShopArgs;
    return client.getListingsByShop(shop_id, { state });
  },

  getListingImages: async (args, client) =>
    client.getListingImages((args as GetListingImagesArgs).listing_id),

  getListingFiles: async (args, client) =>
    client.getListingFiles((args as GetListingFilesArgs).listing_id),

  getListingInventory: async (args, client) =>
    client.getListingInventory((args as GetListingInventoryArgs).listing_id),
};
