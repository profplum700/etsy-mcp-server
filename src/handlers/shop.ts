import type { EtsyMcpApiClient } from "../etsy-api-client.js";

interface GetShopArgs {
  shop_id: string;
}

interface GetShopSectionArgs {
  shop_id: string;
}

export const tools = [
  {
    name: "getShop",
    description: "Get shop information",
    inputSchema: {
      type: "object",
      properties: {
        shop_id: {
          type: "string",
          description: "The ID of the shop to retrieve",
        },
      },
      required: ["shop_id"],
    },
  },
  {
    name: "getMe",
    description: "Get info about the authenticated user",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "getShopSections",
    description: "Get sections for a shop",
    inputSchema: {
      type: "object",
      properties: {
        shop_id: { type: "string", description: "The ID of the shop" },
      },
      required: ["shop_id"],
    },
  },
];

export const handlers: Record<
  string,
  (args: unknown, client: EtsyMcpApiClient) => Promise<unknown>
> = {
  getMe: async (_, client) => client.getMe(),
  getShop: async (args, client) => client.getShop((args as GetShopArgs).shop_id),
  getShopSections: async (args, client) =>
    client.getShopSections((args as GetShopSectionArgs).shop_id),
};
