import type { EtsyMcpApiClient } from "../etsy-api-client.js";

interface GetPropertiesByTaxonomyIdArgs {
  taxonomy_id: string;
}

export const tools = [
  {
    name: "getSellerTaxonomyNodes",
    description: "Retrieve the full hierarchy tree of seller taxonomy nodes",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "getPropertiesByTaxonomyId",
    description: "Get product properties supported for a specific taxonomy ID",
    inputSchema: {
      type: "object",
      properties: {
        taxonomy_id: {
          type: "string",
          description: "The seller taxonomy node ID",
        },
      },
      required: ["taxonomy_id"],
    },
  },
];

export const handlers: Record<
  string,
  (args: unknown, client: EtsyMcpApiClient) => Promise<unknown>
> = {
  getSellerTaxonomyNodes: async (_, client) => client.getSellerTaxonomyNodes(),

  getPropertiesByTaxonomyId: async (args, client) =>
    client.getPropertiesByTaxonomyId((args as GetPropertiesByTaxonomyIdArgs).taxonomy_id),
};
