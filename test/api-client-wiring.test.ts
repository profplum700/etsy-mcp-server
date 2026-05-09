import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { describe, expect, it, vi, afterEach } from "vitest";
import { EtsyApiError } from "@profplum700/etsy-v3-api-client";
import {
  createEtsyApiClient,
  formatEtsyFailure,
  type TokenProvider,
} from "../src/etsy-api-client.js";
import { handlers as shopHandlers } from "../src/handlers/shop.js";
import { tools as listingTools } from "../src/handlers/listing.js";
import { EtsyServer } from "../src/index.js";

describe("api-client wiring", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("routes MCP read handlers through the api-client adapter and propagates token provider output", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers as HeadersInit);
      expect(headers.get("Authorization")).toBe("Bearer provider-access-token");
      expect(headers.get("x-api-key")).toBe("api-key:shared-secret");
      return new Response(JSON.stringify({ shop_id: 123, shop_name: "Test Shop" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const tokenProvider: TokenProvider = {
      getAccessToken: vi.fn(async () => "provider-access-token"),
      getCurrentTokens: () => ({
        access_token: "provider-access-token",
        refresh_token: "refresh-token",
        expires_at: new Date(Date.now() + 3_600_000),
        token_type: "Bearer",
        scope: "shops_r listings_r",
      }),
    };

    const client = createEtsyApiClient({
      apiKey: "api-key",
      sharedSecret: "shared-secret",
      refreshToken: "refresh-token",
      tokenProvider,
    });

    const result = await shopHandlers.getShop({ shop_id: "123" }, client);

    expect(result).toEqual({ shop_id: 123, shop_name: "Test Shop" });
    expect(tokenProvider.getAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.etsy.com/v3/application/shops/123",
      expect.any(Object)
    );
  });

  it("maps Etsy errors without including response payload secrets", () => {
    const secret = "secret-refresh-token-value";
    const message = formatEtsyFailure(
      new EtsyApiError("Etsy API error: 401 Unauthorized", 401, { secret })
    );

    expect(message).toContain("Etsy API error (401)");
    expect(message).not.toContain(secret);
  });

  it("keeps token provider failures secret-safe in MCP tool output", async () => {
    const secret = "provider-secret-value";
    const server = new EtsyServer({
      apiClient: createEtsyApiClient({
        apiKey: "api-key",
        sharedSecret: "shared-secret",
        refreshToken: "refresh-token",
        tokenProvider: {
          getAccessToken: async () => {
            throw new Error(secret);
          },
        },
      }),
    });

    const result = await server.callTool("getShop", { shop_id: "123" });
    const text = result.content[0]?.text ?? "";

    expect(result.isError).toBe(true);
    expect(text).not.toContain(secret);
  });

  it("does not expose Etsy write tools in the V1 tool surface", () => {
    const toolNames = listingTools.map((tool) => tool.name);

    expect(toolNames).toEqual([
      "getListingsByShop",
      "getListingImages",
      "getListingFiles",
      "getListingInventory",
    ]);
    expect(toolNames).not.toContain("createDraftListing");
    expect(toolNames).not.toContain("uploadListingImage");
    expect(toolNames).not.toContain("updateListing");
    expect(toolNames).not.toContain("updateListingInventory");
  });

  it("keeps direct Etsy HTTP and OAuth request patterns out of local source", () => {
    const files = execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "src", "test"],
      { encoding: "utf8" }
    )
      .split("\n")
      .filter(Boolean)
      .filter((file) => file.endsWith(".ts"));
    const violations: string[] = [];
    const forbidden = [
      /from ["']axios["']/,
      /axios\./,
      /api\.etsy\.com\/v3/,
      /oauth\/token/,
      /Authorization\s*:/,
      /x-api-key\s*:/,
    ];

    for (const file of files) {
      if (file === "test/api-client-wiring.test.ts") {
        continue;
      }
      const content = readFileSync(file, "utf8");
      for (const pattern of forbidden) {
        if (pattern.test(content)) {
          violations.push(`${file}: ${pattern}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
