import { AxiosInstance } from "axios";

interface GetShopArgs {
  shop_id: string;
}

interface GetShopSectionArgs {
  shop_id: string;
  shop_section_id: string;
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

export const handlers: Record<string, (args: unknown, axios: AxiosInstance) => Promise<unknown>> = {
  getMe: async (_, axios) => axios.get("/application/users/me"),
  getShop: async (args, axios) => axios.get(`/application/shops/${(args as GetShopArgs).shop_id}`),
  getShopSections: async (args, axios) =>
    axios.get(`/application/shops/${(args as GetShopSectionArgs).shop_id}/sections`),
};
