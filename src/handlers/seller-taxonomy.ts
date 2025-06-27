import { AxiosInstance } from "axios";

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
  (args: unknown, axios: AxiosInstance) => Promise<unknown>
> = {
  getSellerTaxonomyNodes: async (_, axios) =>
    axios.get("/application/seller-taxonomy/nodes"),

  getPropertiesByTaxonomyId: async (args, axios) =>
    axios.get(
      `/application/seller-taxonomy/nodes/${(args as GetPropertiesByTaxonomyIdArgs).taxonomy_id}/properties`,
    ),
};
