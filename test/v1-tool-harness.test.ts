import { describe, expect, it, vi } from "vitest";
import { handleWorkerRequest, type WorkerEnv } from "../src/worker.js";
import type { EtsyMcpApiClient } from "../src/etsy-api-client.js";
import { EtsyServer } from "../src/index.js";
import { handlers as readHandlers } from "../src/handlers/v1-read-tools.js";
import { handlers as referenceHandlers } from "../src/handlers/reference.js";
import { V1_TOOL_CONTRACT, type JsonSchema } from "../src/tool-contract.js";

const bearer = ["contract", "harness", "bearer"].join("-");
const workerEnv: WorkerEnv = {
  ETSY_API_KEY: "test-api-key",
  ETSY_SHARED_SECRET: "test-shared-secret",
  ETSY_REFRESH_TOKEN: "test-refresh-token",
  MCP_BEARER: bearer,
};

const implementedContractToolNames = V1_TOOL_CONTRACT.filter(
  (tool) => tool.risk !== "deferred_write"
).map((tool) => tool.name);
const deferredWriteToolNames = V1_TOOL_CONTRACT.filter(
  (tool) => tool.risk === "deferred_write"
).map((tool) => tool.name);

function createMockClient(overrides: Partial<EtsyMcpApiClient> = {}): EtsyMcpApiClient {
  return {
    tokenProvider: { getAccessToken: vi.fn(async () => "test-access-token") },
    searchPublicListings: vi.fn(async () => ({ results: [{ listing_id: 1, title: "Public" }] })),
    getMe: vi.fn(async () => ({ user_id: 2, shop_id: 3, login_name: "seller" })),
    getShop: vi.fn(async () => ({ shop_id: 3, shop_name: "Generic Shop" })),
    getShopContext: vi.fn(async () => ({
      user: { user_id: 2, shop_id: 3, login_name: "seller" },
      shop: { shop_id: 3, shop_name: "Generic Shop" },
    })),
    getShopSections: vi.fn(),
    getListingsByShop: vi.fn(async () => ({ results: [{ listing_id: 4, title: "Listing" }] })),
    getListingFull: vi.fn(async () => ({ listing_id: 4, title: "Listing", Images: [] })),
    getListingImages: vi.fn(),
    getListingFiles: vi.fn(),
    getListingInventory: vi.fn(),
    getReceipts: vi.fn(async () => ({ results: [{ receipt_id: 5, status: "paid" }] })),
    getReceiptFull: vi.fn(async () => ({ receipt_id: 5, status: "paid", transactions: [] })),
    getSellerTaxonomyNodes: vi.fn(),
    getPropertiesByTaxonomyId: vi.fn(async () => ({ results: [{ property_id: 6, name: "color" }] })),
    getShopShippingProfiles: vi.fn(async () => ({
      results: [{ shipping_profile_id: 7, title: "Standard" }],
    })),
    ...overrides,
  };
}

function mcpRequest(body: unknown, authorization?: string): Request {
  const headers = new Headers({
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
  });
  if (authorization) {
    headers.set("Authorization", authorization);
  }

  return new Request("https://worker.test/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function assertSchema(value: unknown, schema: JsonSchema, path = "output"): void {
  if (schema.type === "object") {
    expect(value, `${path} must be object`).toEqual(expect.any(Object));
    expect(Array.isArray(value), `${path} must not be array`).toBe(false);
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      expect(record[key], `${path}.${key} is required`).not.toBeUndefined();
    }
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties ?? {}));
      expect(Object.keys(record).filter((key) => !allowed.has(key))).toEqual([]);
    }
    for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
      if (record[key] !== undefined) {
        assertSchema(record[key], childSchema, `${path}.${key}`);
      }
    }
    return;
  }

  if (schema.type === "array") {
    expect(Array.isArray(value), `${path} must be array`).toBe(true);
    if (schema.items) {
      for (const [index, item] of (value as unknown[]).entries()) {
        assertSchema(item, schema.items, `${path}[${index}]`);
      }
    }
    return;
  }

  if (schema.type === "integer") {
    expect(Number.isInteger(value), `${path} must be integer`).toBe(true);
    return;
  }

  if (schema.type === "number") {
    expect(typeof value, `${path} must be number`).toBe("number");
    expect(Number.isFinite(value), `${path} must be finite`).toBe(true);
    return;
  }

  if (schema.type === "string") {
    expect(typeof value, `${path} must be string`).toBe("string");
    return;
  }

  if (schema.type === "boolean") {
    expect(typeof value, `${path} must be boolean`).toBe("boolean");
  }
}

describe("aggregate V1 MCP tool harness", () => {
  it("registers every implemented contract tool on the stdio server and no deferred write tools", async () => {
    const server = new EtsyServer({ apiClient: createMockClient() });
    const toolNames = (await server.listTools()).map((tool) => tool.name);

    expect(toolNames).toEqual(expect.arrayContaining(implementedContractToolNames));
    for (const name of deferredWriteToolNames) {
      expect(toolNames).not.toContain(name);
    }
  });

  it("registers every implemented contract tool on the Worker Streamable HTTP path after bearer auth", async () => {
    const response = await handleWorkerRequest(
      mcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }, `Bearer ${bearer}`),
      workerEnv
    );
    const body = await response.json();
    const toolNames = body.result.tools.map((tool: { name: string }) => tool.name);

    expect(response.status).toBe(200);
    expect(toolNames).toEqual(expect.arrayContaining(implementedContractToolNames));
    for (const name of deferredWriteToolNames) {
      expect(toolNames).not.toContain(name);
    }
  });

  it("keeps Worker health public while /mcp requires a bearer token", async () => {
    const health = await handleWorkerRequest(new Request("https://worker.test/healthz"), workerEnv);
    const unauthorized = await handleWorkerRequest(
      mcpRequest({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
      workerEnv
    );

    expect(health.status).toBe(200);
    expect(unauthorized.status).toBe(401);
    await expect(unauthorized.text()).resolves.not.toContain(bearer);
  });

  it("keeps implemented handler outputs conformant with the contract output schemas", async () => {
    const client = createMockClient();
    const samples: Record<string, unknown> = {
      etsy_search_public_listings: { keywords: "print", limit: 1 },
      etsy_get_public_shop: { shop_id: "3" },
      etsy_get_authenticated_user: {},
      etsy_get_shop_context: {},
      etsy_list_shop_listings: { shop_id: "3", state: "active", limit: 1 },
      etsy_get_listing_full: { listing_id: "4" },
      etsy_get_receipts: { shop_id: "3", limit: 1 },
      etsy_get_receipt_full: { shop_id: "3", receipt_id: "5" },
      etsy_get_taxonomy_properties: { taxonomy_id: "6" },
      etsy_get_shipping_profiles: { shop_id: "3" },
    };
    const allHandlers: Record<string, (args: unknown, client: EtsyMcpApiClient) => Promise<unknown>> = {
      ...readHandlers,
      ...referenceHandlers,
    };

    for (const toolName of implementedContractToolNames) {
      const contract = V1_TOOL_CONTRACT.find((tool) => tool.name === toolName);
      const handler = allHandlers[toolName];
      expect(handler, `${toolName} handler missing`).toEqual(expect.any(Function));
      expect(contract, `${toolName} contract missing`).toBeDefined();
      const output = await handler(samples[toolName], client);
      assertSchema(output, contract!.outputSchema, toolName);
    }
  });

  it("redacts bearer and token-shaped secrets from MCP tool errors", async () => {
    const secret = "Bearer eyJhbGciOiJsecretsecretsecretsecret";
    const server = new EtsyServer({
      apiClient: createMockClient({
        getListingFull: vi.fn(async () => {
          throw new Error(`api-client failure with ${secret} refresh_token=abc123`);
        }),
      }),
    });

    const result = await server.callTool("etsy_get_listing_full", { listing_id: "4" });
    const text = result.content[0]?.text ?? "";

    expect(result.isError).toBe(true);
    expect(text).toContain("api-client failure");
    expect(text).not.toContain(secret);
    expect(text).not.toContain("abc123");
    expect(text).toContain("[REDACTED]");
  });

  it("rejects invalid decimal IDs before api-client invocation", async () => {
    const getListingFull = vi.fn();
    const server = new EtsyServer({ apiClient: createMockClient({ getListingFull }) });

    const result = await server.callTool("etsy_get_listing_full", { listing_id: "listing-4" });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("decimal string");
    expect(getListingFull).not.toHaveBeenCalled();
  });
});
