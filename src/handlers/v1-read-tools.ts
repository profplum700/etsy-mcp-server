import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import type { EtsyMcpApiClient, ListingFullIncludes } from "../etsy-api-client.js";
import { V1_TOOL_CONTRACT, type JsonSchema } from "../tool-contract.js";

const IMPLEMENTED_TOOL_NAMES = [
  "etsy_search_public_listings",
  "etsy_get_public_shop",
  "etsy_get_authenticated_user",
  "etsy_get_shop_context",
  "etsy_list_shop_listings",
  "etsy_get_listing_full",
  "etsy_get_receipts",
  "etsy_get_receipt_full",
] as const;

type ImplementedToolName = (typeof IMPLEMENTED_TOOL_NAMES)[number];

type JsonRecord = Record<string, unknown>;

type Handler = (args: unknown, client: EtsyMcpApiClient) => Promise<unknown>;

const contractByName = new Map(V1_TOOL_CONTRACT.map((tool) => [tool.name, tool]));

export const tools = IMPLEMENTED_TOOL_NAMES.map((name) => {
  const contract = contractByName.get(name);
  if (!contract) {
    throw new Error(`Missing V1 tool contract for ${name}`);
  }

  return {
    name: contract.name,
    description: contract.description,
    inputSchema: contract.inputSchema,
  };
});

export const DEFAULT_LISTING_FULL_INCLUDES: ListingFullIncludes[] = [
  "Images",
  "Inventory",
  "Translations",
  "Shop",
  "Shipping",
  "Videos",
];

function validateToolArgs(toolName: ImplementedToolName, args: unknown): JsonRecord {
  const contract = contractByName.get(toolName);
  if (!contract) {
    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
  }

  const value = args ?? {};
  validateSchema(contract.inputSchema, value, toolName);
  return value as JsonRecord;
}

function validateSchema(schema: JsonSchema, value: unknown, path: string): void {
  if (schema.type === "object") {
    if (!isRecord(value)) {
      throw new McpError(ErrorCode.InvalidParams, `${path} must be an object`);
    }

    const properties = schema.properties ?? {};
    for (const key of schema.required ?? []) {
      if (value[key] === undefined || value[key] === null) {
        throw new McpError(ErrorCode.InvalidParams, `${path}.${key} is required`);
      }
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) {
          throw new McpError(ErrorCode.InvalidParams, `${path}.${key} is not supported`);
        }
      }
    }

    for (const [key, childSchema] of Object.entries(properties)) {
      if (value[key] !== undefined && value[key] !== null) {
        validateSchema(childSchema, value[key], `${path}.${key}`);
      }
    }
    return;
  }

  if (schema.type === "array") {
    if (!Array.isArray(value)) {
      throw new McpError(ErrorCode.InvalidParams, `${path} must be an array`);
    }
    if (schema.items) {
      for (let index = 0; index < value.length; index += 1) {
        validateSchema(schema.items, value[index], `${path}[${index}]`);
      }
    }
    return;
  }

  if (schema.type === "integer") {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      throw new McpError(ErrorCode.InvalidParams, `${path} must be an integer`);
    }
    return;
  }

  if (schema.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new McpError(ErrorCode.InvalidParams, `${path} must be a number`);
    }
    return;
  }

  if (schema.type === "string") {
    if (typeof value !== "string" || value.length === 0) {
      throw new McpError(ErrorCode.InvalidParams, `${path} must be a non-empty string`);
    }
    if (schema.description?.includes("decimal string") && !/^\d+$/.test(value)) {
      throw new McpError(ErrorCode.InvalidParams, `${path} must be a decimal string`);
    }
    if (schema.enum && !schema.enum.includes(value)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `${path} must be one of: ${schema.enum.join(", ")}`
      );
    }
    return;
  }

  if (schema.type === "boolean" && typeof value !== "boolean") {
    throw new McpError(ErrorCode.InvalidParams, `${path} must be a boolean`);
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pick(record: JsonRecord, keys: string[]): JsonRecord {
  const output: JsonRecord = {};
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      output[key] = record[key];
    }
  }
  return output;
}

function asResults(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (isRecord(value) && Array.isArray(value.results)) {
    return value.results;
  }
  return [];
}

function countFrom(value: unknown, results: unknown[]): number {
  if (isRecord(value) && typeof value.count === "number") {
    return value.count;
  }
  return results.length;
}

function thinUser(value: unknown): JsonRecord {
  if (!isRecord(value)) {
    return {};
  }
  return pick(value, ["user_id", "shop_id", "login_name"]);
}

function thinShop(value: unknown): JsonRecord {
  if (!isRecord(value)) {
    return {};
  }
  return pick(value, [
    "shop_id",
    "shop_name",
    "title",
    "announcement",
    "url",
    "currency_code",
    "listing_active_count",
    "digital_listing_count",
    "create_date",
    "created_timestamp",
    "update_date",
    "updated_timestamp",
  ]);
}

function thinListing(value: unknown, includeDetails: boolean): JsonRecord {
  if (!isRecord(value)) {
    return {};
  }

  const listing = pick(value, [
    "listing_id",
    "shop_id",
    "user_id",
    "title",
    "state",
    "url",
    "price",
    "currency_code",
    "quantity",
    "taxonomy_id",
    "shop_section_id",
    "tags",
    "materials",
    "who_made",
    "when_made",
    "is_supply",
    "is_customizable",
    "is_personalizable",
    "personalization_is_required",
    "personalization_char_count_max",
    "created_timestamp",
    "updated_timestamp",
    "creation_tsz",
    "ending_tsz",
  ]);

  if (includeDetails) {
    for (const key of [
      "description",
      "Images",
      "images",
      "Inventory",
      "inventory",
      "Translations",
      "translations",
      "Shop",
      "shop",
      "Shipping",
      "shipping",
      "Videos",
      "videos",
    ]) {
      if (value[key] !== undefined && value[key] !== null) {
        listing[key] = value[key];
      }
    }
  }

  return listing;
}

function thinReceipt(value: unknown, includeDetails: boolean): JsonRecord {
  if (!isRecord(value)) {
    return {};
  }

  const receipt = pick(value, [
    "receipt_id",
    "receipt_type",
    "order_id",
    "shop_id",
    "status",
    "is_paid",
    "is_shipped",
    "grandtotal",
    "subtotal",
    "total_price",
    "currency_code",
    "created_timestamp",
    "updated_timestamp",
    "creation_tsz",
  ]);

  if (includeDetails) {
    for (const key of ["transactions", "shipments", "payments"]) {
      if (value[key] !== undefined && value[key] !== null) {
        receipt[key] = value[key];
      }
    }
  }

  return receipt;
}

function listResponse(value: unknown, mapper: (item: unknown) => JsonRecord): JsonRecord {
  const results = asResults(value).map(mapper);
  return {
    count: countFrom(value, results),
    results,
  };
}

function optionalInteger(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export const handlers: Record<ImplementedToolName, Handler> = {
  etsy_search_public_listings: async (args, client) => {
    const input = validateToolArgs("etsy_search_public_listings", args);
    const response = await client.searchPublicListings({
      keywords: optionalString(input.keywords),
      limit: optionalInteger(input.limit),
      offset: optionalInteger(input.offset),
      taxonomy_id: optionalInteger(input.taxonomy_id),
      min_price: typeof input.min_price === "number" ? input.min_price : undefined,
      max_price: typeof input.max_price === "number" ? input.max_price : undefined,
    });
    return listResponse(response, (listing) => thinListing(listing, false));
  },

  etsy_get_public_shop: async (args, client) => {
    const input = validateToolArgs("etsy_get_public_shop", args);
    return { shop: thinShop(await client.getShop(String(input.shop_id))) };
  },

  etsy_get_authenticated_user: async (args, client) => {
    validateToolArgs("etsy_get_authenticated_user", args);
    return { user: thinUser(await client.getMe()) };
  },

  etsy_get_shop_context: async (args, client) => {
    const input = validateToolArgs("etsy_get_shop_context", args);
    const context = await client.getShopContext(optionalString(input.shop_id));
    if (!isRecord(context)) {
      return { user: {}, shop: {} };
    }
    return {
      user: thinUser(context.user),
      shop: thinShop(context.shop),
    };
  },

  etsy_list_shop_listings: async (args, client) => {
    const input = validateToolArgs("etsy_list_shop_listings", args);
    const response = await client.getListingsByShop(String(input.shop_id), {
      state: optionalString(input.state),
      limit: optionalInteger(input.limit),
      offset: optionalInteger(input.offset),
    });
    return listResponse(response, (listing) => thinListing(listing, false));
  },

  etsy_get_listing_full: async (args, client) => {
    const input = validateToolArgs("etsy_get_listing_full", args);
    const includes = Array.isArray(input.includes)
      ? (input.includes as ListingFullIncludes[])
      : DEFAULT_LISTING_FULL_INCLUDES;
    return {
      listing: thinListing(
        await client.getListingFull(String(input.listing_id), { includes }),
        true
      ),
    };
  },

  etsy_get_receipts: async (args, client) => {
    const input = validateToolArgs("etsy_get_receipts", args);
    const response = await client.getReceipts(String(input.shop_id), {
      limit: optionalInteger(input.limit),
      offset: optionalInteger(input.offset),
    });
    return listResponse(response, (receipt) => thinReceipt(receipt, false));
  },

  etsy_get_receipt_full: async (args, client) => {
    const input = validateToolArgs("etsy_get_receipt_full", args);
    return {
      receipt: thinReceipt(
        await client.getReceiptFull(String(input.shop_id), String(input.receipt_id)),
        true
      ),
    };
  },
};
