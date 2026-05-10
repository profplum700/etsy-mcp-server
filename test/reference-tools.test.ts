import { describe, expect, it, vi } from "vitest";
import {
  EtsyApiError,
  EtsyAuthError,
  EtsyRateLimitError,
} from "@profplum700/etsy-v3-api-client";
import { EtsyServer, type ToolHandler } from "../src/index.js";
import type { EtsyMcpApiClient } from "../src/etsy-api-client.js";
import { handlers, tools } from "../src/handlers/reference.js";
import { V1_TOOL_CONTRACT } from "../src/tool-contract.js";

function createMockClient(overrides: Partial<EtsyMcpApiClient> = {}): EtsyMcpApiClient {
  return {
    tokenProvider: {
      getAccessToken: async () => "test-access-token",
    },
    searchPublicListings: vi.fn(),
    getMe: vi.fn(),
    getShop: vi.fn(),
    getShopContext: vi.fn(),
    getShopSections: vi.fn(),
    getListingsByShop: vi.fn(),
    getListingFull: vi.fn(),
    getListingImages: vi.fn(),
    getListingFiles: vi.fn(),
    getListingInventory: vi.fn(),
    getReceipts: vi.fn(),
    getReceiptFull: vi.fn(),
    getSellerTaxonomyNodes: vi.fn(),
    getPropertiesByTaxonomyId: vi.fn(),
    getShopShippingProfiles: vi.fn(),
    ...overrides,
  };
}

describe("V1 reference read tools", () => {
  it("registers taxonomy and shipping tools from the V1 contract", async () => {
    const server = new EtsyServer({ apiClient: createMockClient() });
    const listedTools = await server.listTools();
    const referenceContracts = V1_TOOL_CONTRACT.filter((tool) =>
      ["etsy_get_taxonomy_properties", "etsy_get_shipping_profiles"].includes(tool.name)
    );

    for (const contract of referenceContracts) {
      const tool = listedTools.find((candidate) => candidate.name === contract.name);
      expect(tool).toMatchObject({
        name: contract.name,
        description: contract.description,
        inputSchema: contract.inputSchema,
      });
    }

    expect(tools.map((tool) => tool.name)).toEqual([
      "etsy_get_taxonomy_properties",
      "etsy_get_shipping_profiles",
    ]);
  });

  it("gets taxonomy properties through the shared api-client and returns thinned JSON", async () => {
    const getPropertiesByTaxonomyId = vi.fn(async () => ({
      results: [
        {
          property_id: 200,
          name: "color",
          display_name: "Color",
          is_required: true,
          supports_attributes: true,
          supports_variations: false,
          possible_values: [
            { value_id: 1, name: "Blue", secret_token: "never-return-this" },
            { value_id: 2, name: "Green" },
          ],
          debug_oauth_token: "never-return-this",
        },
      ],
    }));
    const server = new EtsyServer({
      apiClient: createMockClient({ getPropertiesByTaxonomyId }),
    });

    const result = await server.callTool("etsy_get_taxonomy_properties", { taxonomy_id: "123" });
    const text = result.content[0]?.text ?? "";

    expect(result.isError).toBeUndefined();
    expect(getPropertiesByTaxonomyId).toHaveBeenCalledWith("123");
    expect(JSON.parse(text)).toEqual([
      {
        property_id: 200,
        name: "color",
        display_name: "Color",
        is_required: true,
        supports_attributes: true,
        supports_variations: false,
        possible_values: [
          { value_id: 1, name: "Blue" },
          { value_id: 2, name: "Green" },
        ],
      },
    ]);
    expect(text).not.toContain("never-return-this");
  });

  it("gets shipping profiles through the shared api-client and returns thinned JSON", async () => {
    const getShopShippingProfiles = vi.fn(async () => ({
      results: [
        {
          shipping_profile_id: 300,
          title: "Domestic standard",
          origin_country_iso: "US",
          primary_cost: "4.50",
          secondary_cost: 1.25,
          min_processing_days: 1,
          max_processing_days: 3,
          processing_days_display_label: "1-3 business days",
          profile_type: "manual",
          is_deleted: false,
          refresh_token: "never-return-this",
        },
      ],
    }));
    const server = new EtsyServer({
      apiClient: createMockClient({ getShopShippingProfiles }),
    });

    const result = await server.callTool("etsy_get_shipping_profiles", { shop_id: "456" });
    const text = result.content[0]?.text ?? "";

    expect(result.isError).toBeUndefined();
    expect(getShopShippingProfiles).toHaveBeenCalledWith("456");
    expect(JSON.parse(text)).toEqual([
      {
        shipping_profile_id: 300,
        title: "Domestic standard",
        origin_country_iso: "US",
        primary_cost: 4.5,
        secondary_cost: 1.25,
        min_processing_days: 1,
        max_processing_days: 3,
        processing_days_display_label: "1-3 business days",
        profile_type: "manual",
        is_deleted: false,
      },
    ]);
    expect(text).not.toContain("never-return-this");
  });

  it("returns an empty array for empty or missing reference data", async () => {
    const server = new EtsyServer({
      apiClient: createMockClient({
        getPropertiesByTaxonomyId: vi.fn(async () => ({ results: [] })),
        getShopShippingProfiles: vi.fn(async () => ({})),
      }),
    });

    const taxonomyResult = await server.callTool("etsy_get_taxonomy_properties", {
      taxonomy_id: "123",
    });
    const shippingResult = await server.callTool("etsy_get_shipping_profiles", {
      shop_id: "456",
    });

    expect(JSON.parse(taxonomyResult.content[0]?.text ?? "")).toEqual([]);
    expect(JSON.parse(shippingResult.content[0]?.text ?? "")).toEqual([]);
  });

  it("enforces contract input schemas before api-client calls", async () => {
    const getPropertiesByTaxonomyId = vi.fn();
    const getShopShippingProfiles = vi.fn();
    const server = new EtsyServer({
      apiClient: createMockClient({ getPropertiesByTaxonomyId, getShopShippingProfiles }),
    });

    const taxonomyResult = await server.callTool("etsy_get_taxonomy_properties", {
      taxonomy_id: "not-numeric",
    });
    const shippingResult = await server.callTool("etsy_get_shipping_profiles", {
      shop_id: "456",
      extra: "not allowed",
    });

    expect(taxonomyResult.isError).toBe(true);
    expect(taxonomyResult.content[0]?.text).toContain("taxonomy_id must be a decimal string");
    expect(shippingResult.isError).toBe(true);
    expect(shippingResult.content[0]?.text).toContain("unsupported argument");
    expect(getPropertiesByTaxonomyId).not.toHaveBeenCalled();
    expect(getShopShippingProfiles).not.toHaveBeenCalled();
  });

  it("maps Etsy auth, rate-limit, 5xx, and generic api-client failures safely", async () => {
    const getShopShippingProfiles = vi.fn(async () => {
      throw new EtsyAuthError("secret auth failure", "TOKEN_FAILED");
    });
    const server = new EtsyServer({
      apiClient: createMockClient({ getShopShippingProfiles }),
    });

    const authResult = await server.callTool("etsy_get_shipping_profiles", { shop_id: "456" });
    getShopShippingProfiles.mockRejectedValueOnce(
      new EtsyRateLimitError("secret rate limit failure", 30)
    );
    const rateLimitResult = await server.callTool("etsy_get_shipping_profiles", { shop_id: "456" });
    getShopShippingProfiles.mockRejectedValueOnce(
      new EtsyApiError("Etsy API error: 503 Service Unavailable", 503, {
        bearer: "never-return-this",
      })
    );
    const serviceErrorResult = await server.callTool("etsy_get_shipping_profiles", {
      shop_id: "456",
    });
    getShopShippingProfiles.mockRejectedValueOnce(new Error("api-client failed safely"));
    const genericResult = await server.callTool("etsy_get_shipping_profiles", { shop_id: "456" });

    expect(authResult.isError).toBe(true);
    expect(authResult.content[0]?.text).toBe("Etsy API authentication error");
    expect(rateLimitResult.isError).toBe(true);
    expect(rateLimitResult.content[0]?.text).toBe("Etsy API rate limit error");
    expect(serviceErrorResult.isError).toBe(true);
    expect(serviceErrorResult.content[0]?.text).toContain("Etsy API error (503)");
    expect(serviceErrorResult.content[0]?.text).not.toContain("never-return-this");
    expect(genericResult.isError).toBe(true);
    expect(genericResult.content[0]?.text).toBe("Error: api-client failed safely");
  });

  it("keeps handler keys limited to the pane-owned reference tools", () => {
    expect(Object.keys(handlers)).toEqual([
      "etsy_get_taxonomy_properties",
      "etsy_get_shipping_profiles",
    ] satisfies Array<keyof typeof handlers>);
    expect(Object.values(handlers).every((handler): handler is ToolHandler => typeof handler === "function")).toBe(
      true
    );
  });
});
