export type ToolRisk = "read_only" | "read_sensitive" | "deferred_write";
export type PermissionPolicy = "always_allow" | "disabled_in_v1";

export type JsonSchema = {
  type: "object" | "array" | "string" | "number" | "integer" | "boolean" | "null";
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: readonly string[];
  additionalProperties?: boolean | JsonSchema;
};

export interface ApiClientMapping {
  methods: readonly string[];
  operations: readonly string[];
  endpointCoverage: "covered" | "covered_by_composition";
}

export interface V1ToolContract {
  name: string;
  description: string;
  risk: ToolRisk;
  permissionPolicy: PermissionPolicy;
  enabledForRecommendationRuns: boolean;
  authScopes: readonly string[];
  consumers: readonly string[];
  apiClient: ApiClientMapping;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  testOwner: string;
}

const emptyInputSchema = (description: string): JsonSchema => ({
  type: "object",
  description,
  properties: {},
  additionalProperties: false,
});

const numericId = (description: string): JsonSchema => ({
  type: "string",
  description,
});

const genericObjectOutput = (description: string): JsonSchema => ({
  type: "object",
  description,
  additionalProperties: true,
});

const genericArrayOutput = (description: string): JsonSchema => ({
  type: "array",
  description,
  items: genericObjectOutput("Etsy resource object"),
});

const shopIdProperty = numericId("Etsy shop ID as a decimal string");
const listingIdProperty = numericId("Etsy listing ID as a decimal string");

export const V1_TOOL_CONTRACT = [
  {
    name: "etsy_search_public_listings",
    description: "Search public active listings for optional reference context.",
    risk: "read_only",
    permissionPolicy: "always_allow",
    enabledForRecommendationRuns: true,
    authScopes: ["x-api-key"],
    consumers: ["mcp-server"],
    apiClient: {
      methods: ["EtsyClient.findAllListingsActive"],
      operations: ["findAllListingsActive GET /v3/application/listings/active"],
      endpointCoverage: "covered",
    },
    inputSchema: {
      type: "object",
      properties: {
        keywords: { type: "string", description: "Optional search keywords" },
        limit: { type: "integer", description: "Maximum number of listings to return" },
        offset: { type: "integer", description: "Pagination offset" },
        taxonomy_id: { type: "integer", description: "Optional seller taxonomy ID" },
        min_price: { type: "number", description: "Optional minimum price" },
        max_price: { type: "number", description: "Optional maximum price" },
      },
      additionalProperties: false,
    },
    outputSchema: genericArrayOutput("Public listing search results"),
    testOwner: "read-tool implementation",
  },
  {
    name: "etsy_get_public_shop",
    description: "Fetch public shop information by shop ID.",
    risk: "read_only",
    permissionPolicy: "always_allow",
    enabledForRecommendationRuns: true,
    authScopes: ["x-api-key"],
    consumers: ["mcp-server"],
    apiClient: {
      methods: ["EtsyClient.getShop"],
      operations: ["getShop GET /v3/application/shops/{shop_id}"],
      endpointCoverage: "covered",
    },
    inputSchema: {
      type: "object",
      properties: { shop_id: shopIdProperty },
      required: ["shop_id"],
      additionalProperties: false,
    },
    outputSchema: genericObjectOutput("Shop resource"),
    testOwner: "tool contract",
  },
  {
    name: "etsy_get_authenticated_user",
    description: "Fetch the authenticated Etsy user for shop-context composition.",
    risk: "read_only",
    permissionPolicy: "always_allow",
    enabledForRecommendationRuns: true,
    authScopes: ["x-api-key", "shops_r"],
    consumers: ["mcp-server", "snapshot-ingester"],
    apiClient: {
      methods: ["EtsyClient.getUser", "EtsyClient.getMe"],
      operations: ["getMe GET /v3/application/users/me"],
      endpointCoverage: "covered",
    },
    inputSchema: emptyInputSchema("No input required"),
    outputSchema: genericObjectOutput("Authenticated user resource"),
    testOwner: "tool contract",
  },
  {
    name: "etsy_get_shop_context",
    description: "Compose authenticated user and shop details for a seller context summary.",
    risk: "read_only",
    permissionPolicy: "always_allow",
    enabledForRecommendationRuns: true,
    authScopes: ["x-api-key", "shops_r"],
    consumers: ["mcp-server", "snapshot-ingester"],
    apiClient: {
      methods: ["EtsyClient.getUser", "EtsyClient.getMe", "EtsyClient.getShop"],
      operations: [
        "getMe GET /v3/application/users/me",
        "getShop GET /v3/application/shops/{shop_id}",
      ],
      endpointCoverage: "covered_by_composition",
    },
    inputSchema: {
      type: "object",
      properties: { shop_id: shopIdProperty },
      additionalProperties: false,
    },
    outputSchema: genericObjectOutput("Composed user and shop context"),
    testOwner: "read-tool implementation",
  },
  {
    name: "etsy_list_shop_listings",
    description: "List shop listings with pagination and state filters.",
    risk: "read_only",
    permissionPolicy: "always_allow",
    enabledForRecommendationRuns: true,
    authScopes: ["x-api-key", "listings_r"],
    consumers: ["mcp-server", "snapshot-ingester"],
    apiClient: {
      methods: ["EtsyClient.getListingsByShop"],
      operations: ["getListingsByShop GET /v3/application/shops/{shop_id}/listings"],
      endpointCoverage: "covered",
    },
    inputSchema: {
      type: "object",
      properties: {
        shop_id: shopIdProperty,
        state: {
          type: "string",
          description: "Listing state filter",
          enum: ["active", "inactive", "sold_out", "draft", "expired"],
        },
        limit: { type: "integer", description: "Maximum number of listings to return" },
        offset: { type: "integer", description: "Pagination offset" },
      },
      required: ["shop_id"],
      additionalProperties: false,
    },
    outputSchema: genericArrayOutput("Shop listing page"),
    testOwner: "read-tool implementation",
  },
  {
    name: "etsy_get_listing_full",
    description: "Fetch a listing with optional include expansions for agent drill-in.",
    risk: "read_only",
    permissionPolicy: "always_allow",
    enabledForRecommendationRuns: true,
    authScopes: ["x-api-key"],
    consumers: ["mcp-server", "snapshot-ingester"],
    apiClient: {
      methods: ["EtsyClient.getListing", "EtsyClient.getListingInventory"],
      operations: [
        "getListing GET /v3/application/listings/{listing_id}",
        "getListingInventory GET /v3/application/listings/{listing_id}/inventory",
      ],
      endpointCoverage: "covered",
    },
    inputSchema: {
      type: "object",
      properties: {
        listing_id: listingIdProperty,
        includes: {
          type: "array",
          description: "Optional Etsy include expansions",
          items: {
            type: "string",
            enum: ["Images", "Inventory", "Translations", "Shop", "Shipping", "Videos"],
          },
        },
      },
      required: ["listing_id"],
      additionalProperties: false,
    },
    outputSchema: genericObjectOutput("Listing detail with requested expansions"),
    testOwner: "read-tool implementation",
  },
  {
    name: "etsy_update_listing_content",
    description: "Deferred content update surface for a future approved execution flow.",
    risk: "deferred_write",
    permissionPolicy: "disabled_in_v1",
    enabledForRecommendationRuns: false,
    authScopes: ["x-api-key", "listings_w"],
    consumers: ["future-execution"],
    apiClient: {
      methods: ["EtsyClient.updateListing"],
      operations: ["updateListing PATCH /v3/application/shops/{shop_id}/listings/{listing_id}"],
      endpointCoverage: "covered",
    },
    inputSchema: {
      type: "object",
      properties: {
        shop_id: shopIdProperty,
        listing_id: listingIdProperty,
        title: { type: "string", description: "Optional replacement title" },
        description: { type: "string", description: "Optional replacement description" },
        state: { type: "string", enum: ["active", "inactive"] },
      },
      required: ["shop_id", "listing_id"],
      additionalProperties: false,
    },
    outputSchema: genericObjectOutput("Updated listing resource"),
    testOwner: "deferred-write harness",
  },
  {
    name: "etsy_update_listing_personalization",
    description:
      "Deferred personalization replacement surface for a future approved execution flow.",
    risk: "deferred_write",
    permissionPolicy: "disabled_in_v1",
    enabledForRecommendationRuns: false,
    authScopes: ["x-api-key", "listings_w"],
    consumers: ["future-execution"],
    apiClient: {
      methods: ["EtsyClient.updateListingPersonalization"],
      operations: [
        "updateListingPersonalization POST /v3/application/shops/{shop_id}/listings/{listing_id}/personalization",
      ],
      endpointCoverage: "covered",
    },
    inputSchema: {
      type: "object",
      properties: {
        shop_id: shopIdProperty,
        listing_id: listingIdProperty,
        supports_multiple_personalization_questions: {
          type: "boolean",
          description: "True only when caller supports the multi-question Etsy shape",
        },
        personalization_questions: {
          type: "array",
          description: "Replacement personalization question list",
          items: genericObjectOutput("Personalization question"),
        },
      },
      required: ["shop_id", "listing_id", "personalization_questions"],
      additionalProperties: false,
    },
    outputSchema: genericObjectOutput("Updated personalization resource"),
    testOwner: "deferred-write harness",
  },
  {
    name: "etsy_upload_listing_media",
    description: "Deferred media upload surface for a future approved execution flow.",
    risk: "deferred_write",
    permissionPolicy: "disabled_in_v1",
    enabledForRecommendationRuns: false,
    authScopes: ["x-api-key", "listings_w"],
    consumers: ["future-execution"],
    apiClient: {
      methods: [
        "EtsyClient.uploadListingImage",
        "EtsyClient.uploadListingFile",
        "EtsyClient.uploadListingVideo",
      ],
      operations: [
        "uploadListingImage POST /v3/application/shops/{shop_id}/listings/{listing_id}/images",
        "uploadListingFile POST /v3/application/shops/{shop_id}/listings/{listing_id}/files",
        "uploadListingVideo POST /v3/application/shops/{shop_id}/listings/{listing_id}/videos",
      ],
      endpointCoverage: "covered",
    },
    inputSchema: {
      type: "object",
      properties: {
        shop_id: shopIdProperty,
        listing_id: listingIdProperty,
        media_kind: { type: "string", enum: ["image", "file", "video"] },
      },
      required: ["shop_id", "listing_id", "media_kind"],
      additionalProperties: false,
    },
    outputSchema: genericObjectOutput("Uploaded media resource"),
    testOwner: "deferred-write harness",
  },
  {
    name: "etsy_get_receipts",
    description: "Read receipt summaries for a future performance-context tool.",
    risk: "read_sensitive",
    permissionPolicy: "disabled_in_v1",
    enabledForRecommendationRuns: false,
    authScopes: ["x-api-key", "transactions_r"],
    consumers: ["mcp-server"],
    apiClient: {
      methods: ["EtsyClient.getShopReceipts"],
      operations: ["getShopReceipts GET /v3/application/shops/{shop_id}/receipts"],
      endpointCoverage: "covered",
    },
    inputSchema: {
      type: "object",
      properties: {
        shop_id: shopIdProperty,
        limit: { type: "integer", description: "Maximum number of receipts to return" },
        offset: { type: "integer", description: "Pagination offset" },
      },
      required: ["shop_id"],
      additionalProperties: false,
    },
    outputSchema: genericArrayOutput("Receipt summaries"),
    testOwner: "read-sensitive harness",
  },
  {
    name: "etsy_get_receipt_full",
    description: "Read one receipt for a future performance-context tool.",
    risk: "read_sensitive",
    permissionPolicy: "disabled_in_v1",
    enabledForRecommendationRuns: false,
    authScopes: ["x-api-key", "transactions_r"],
    consumers: ["mcp-server"],
    apiClient: {
      methods: ["EtsyClient.getShopReceipt"],
      operations: ["getShopReceipt GET /v3/application/shops/{shop_id}/receipts/{receipt_id}"],
      endpointCoverage: "covered",
    },
    inputSchema: {
      type: "object",
      properties: {
        shop_id: shopIdProperty,
        receipt_id: numericId("Etsy receipt ID as a decimal string"),
      },
      required: ["shop_id", "receipt_id"],
      additionalProperties: false,
    },
    outputSchema: genericObjectOutput("Receipt detail"),
    testOwner: "read-sensitive harness",
  },
  {
    name: "etsy_get_taxonomy_properties",
    description: "Fetch seller taxonomy properties for a taxonomy node.",
    risk: "read_only",
    permissionPolicy: "always_allow",
    enabledForRecommendationRuns: true,
    authScopes: ["x-api-key"],
    consumers: ["mcp-server"],
    apiClient: {
      methods: ["EtsyClient.getPropertiesByTaxonomyId"],
      operations: [
        "getPropertiesByTaxonomyId GET /v3/application/seller-taxonomy/nodes/{taxonomy_id}/properties",
      ],
      endpointCoverage: "covered",
    },
    inputSchema: {
      type: "object",
      properties: { taxonomy_id: numericId("Seller taxonomy node ID as a decimal string") },
      required: ["taxonomy_id"],
      additionalProperties: false,
    },
    outputSchema: genericArrayOutput("Taxonomy property definitions"),
    testOwner: "reference-tool implementation",
  },
  {
    name: "etsy_get_shipping_profiles",
    description: "Fetch shipping profiles for a shop.",
    risk: "read_only",
    permissionPolicy: "always_allow",
    enabledForRecommendationRuns: true,
    authScopes: ["x-api-key", "shops_r"],
    consumers: ["mcp-server"],
    apiClient: {
      methods: ["EtsyClient.getShopShippingProfiles"],
      operations: ["getShopShippingProfiles GET /v3/application/shops/{shop_id}/shipping-profiles"],
      endpointCoverage: "covered",
    },
    inputSchema: {
      type: "object",
      properties: { shop_id: shopIdProperty },
      required: ["shop_id"],
      additionalProperties: false,
    },
    outputSchema: genericArrayOutput("Shipping profile resources"),
    testOwner: "reference-tool implementation",
  },
] as const satisfies readonly V1ToolContract[];

export const V1_RECOMMENDATION_TOOL_NAMES = V1_TOOL_CONTRACT.filter(
  (tool) => tool.enabledForRecommendationRuns
).map((tool) => tool.name);

export const V1_DISABLED_TOOL_NAMES = V1_TOOL_CONTRACT.filter(
  (tool) => !tool.enabledForRecommendationRuns
).map((tool) => tool.name);
