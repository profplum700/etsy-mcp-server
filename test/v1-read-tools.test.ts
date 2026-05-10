import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it, vi } from "vitest";
import { EtsyApiError } from "@profplum700/etsy-v3-api-client";
import type { EtsyMcpApiClient } from "../src/etsy-api-client.js";
import { EtsyServer } from "../src/index.js";
import { V1_TOOL_CONTRACT } from "../src/tool-contract.js";
import { DEFAULT_LISTING_FULL_INCLUDES, handlers, tools } from "../src/handlers/v1-read-tools.js";

function createMockClient(): EtsyMcpApiClient {
  return {
    tokenProvider: { getAccessToken: vi.fn(async () => "test-access-token") },
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
  };
}

describe("V1 shop/listing/read-sensitive tools", () => {
  it("registers the non-reference read tools from the V1 contract", async () => {
    const expectedNames = [
      "etsy_search_public_listings",
      "etsy_get_public_shop",
      "etsy_get_authenticated_user",
      "etsy_get_shop_context",
      "etsy_list_shop_listings",
      "etsy_get_listing_full",
      "etsy_get_receipts",
      "etsy_get_receipt_full",
    ];

    expect(tools.map((tool) => tool.name)).toEqual(expectedNames);
    for (const tool of tools) {
      const contract = V1_TOOL_CONTRACT.find((entry) => entry.name === tool.name);
      expect(tool.description).toBe(contract?.description);
      expect(tool.inputSchema).toEqual(contract?.inputSchema);
    }

    const server = new EtsyServer({ apiClient: createMockClient() });
    const serverToolNames = (await server.listTools()).map((tool) => tool.name);
    expect(serverToolNames).toEqual(expect.arrayContaining(expectedNames));
  });

  it("searches public listings through the api-client and returns thinned results", async () => {
    const client = createMockClient();
    vi.mocked(client.searchPublicListings).mockResolvedValue({
      count: 1,
      results: [
        {
          listing_id: 100,
          title: "Public listing",
          state: "active",
          price: { amount: 1250, divisor: 100, currency_code: "USD" },
          private_note: "do-not-return",
        },
      ],
    });

    const result = await handlers.etsy_search_public_listings(
      { keywords: "vintage", limit: 10, offset: 0, min_price: 5 },
      client
    );

    expect(client.searchPublicListings).toHaveBeenCalledWith({
      keywords: "vintage",
      limit: 10,
      offset: 0,
      taxonomy_id: undefined,
      min_price: 5,
      max_price: undefined,
    });
    expect(result).toEqual({
      count: 1,
      results: [
        {
          listing_id: 100,
          title: "Public listing",
          state: "active",
          price: { amount: 1250, divisor: 100, currency_code: "USD" },
        },
      ],
    });
  });

  it("composes shop context and omits unsupported raw fields", async () => {
    const client = createMockClient();
    vi.mocked(client.getShopContext).mockResolvedValue({
      user: { user_id: 1, shop_id: 2, login_name: "seller", oauth_token: "secret" },
      shop: { shop_id: 2, shop_name: "Generic Shop", announcement: "Open", internal: "secret" },
    });

    const result = await handlers.etsy_get_shop_context({}, client);

    expect(client.getShopContext).toHaveBeenCalledWith(undefined);
    expect(result).toEqual({
      user: { user_id: 1, shop_id: 2, login_name: "seller" },
      shop: { shop_id: 2, shop_name: "Generic Shop", announcement: "Open" },
    });
  });

  it("lists shop listings with pagination and validates state", async () => {
    const client = createMockClient();
    vi.mocked(client.getListingsByShop).mockResolvedValue([
      { listing_id: 10, title: "Draft", state: "draft", description: "not in list output" },
    ]);

    const result = await handlers.etsy_list_shop_listings(
      { shop_id: "123", state: "draft", limit: 5, offset: 10 },
      client
    );

    expect(client.getListingsByShop).toHaveBeenCalledWith("123", {
      state: "draft",
      limit: 5,
      offset: 10,
    });
    expect(result).toEqual({
      count: 1,
      results: [{ listing_id: 10, title: "Draft", state: "draft" }],
    });

    await expect(
      handlers.etsy_list_shop_listings({ shop_id: "123", state: "archived" }, client)
    ).rejects.toMatchObject({ code: ErrorCode.InvalidParams } satisfies Partial<McpError>);
  });

  it("fetches full listing details with default includes", async () => {
    const client = createMockClient();
    vi.mocked(client.getListingFull).mockResolvedValue({
      listing_id: 42,
      title: "Detailed listing",
      description: "Full description",
      Images: [{ listing_image_id: 7 }],
      Inventory: { products: [] },
      hidden: "not returned",
    });

    const result = await handlers.etsy_get_listing_full({ listing_id: "42" }, client);

    expect(client.getListingFull).toHaveBeenCalledWith("42", {
      includes: DEFAULT_LISTING_FULL_INCLUDES,
    });
    expect(result).toEqual({
      listing: {
        listing_id: 42,
        title: "Detailed listing",
        description: "Full description",
        Images: [{ listing_image_id: 7 }],
        Inventory: { products: [] },
      },
    });
  });



  it("maps Etsy API errors from V1 tools without leaking response details", async () => {
    const client = createMockClient();
    const hidden = "hidden-token-value";
    vi.mocked(client.getListingFull).mockRejectedValue(
      new EtsyApiError("Etsy API error: 404 Not Found", 404, { hidden })
    );

    const server = new EtsyServer({ apiClient: client });
    const result = await server.callTool("etsy_get_listing_full", { listing_id: "42" });
    const text = result.content[0]?.text ?? "";

    expect(result.isError).toBe(true);
    expect(text).toContain("Etsy API error (404)");
    expect(text).not.toContain(hidden);
  });

  it("implements receipt tools but keeps them read-sensitive and outside always-allow", async () => {
    const client = createMockClient();
    vi.mocked(client.getReceipts).mockResolvedValue({
      results: [
        {
          receipt_id: 77,
          status: "paid",
          grandtotal: { amount: 2000, divisor: 100, currency_code: "USD" },
          buyer_email: "buyer@example.invalid",
        },
      ],
    });
    vi.mocked(client.getReceiptFull).mockResolvedValue({
      receipt_id: 77,
      status: "paid",
      transactions: [{ transaction_id: 1 }],
      buyer_user_id: 99,
    });

    const listResult = await handlers.etsy_get_receipts({ shop_id: "123", limit: 1 }, client);
    const fullResult = await handlers.etsy_get_receipt_full(
      { shop_id: "123", receipt_id: "77" },
      client
    );

    expect(listResult).toEqual({
      count: 1,
      results: [
        {
          receipt_id: 77,
          status: "paid",
          grandtotal: { amount: 2000, divisor: 100, currency_code: "USD" },
        },
      ],
    });
    expect(fullResult).toEqual({
      receipt: { receipt_id: 77, status: "paid", transactions: [{ transaction_id: 1 }] },
    });

    const receiptsContract = V1_TOOL_CONTRACT.filter((tool) => tool.name.includes("receipt"));
    for (const tool of receiptsContract) {
      expect(tool.risk).toBe("read_sensitive");
      expect(tool.permissionPolicy).toBe("disabled_in_v1");
      expect(tool.enabledForRecommendationRuns).toBe(false);
    }
  });
});
