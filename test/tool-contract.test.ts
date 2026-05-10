import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  V1_DISABLED_TOOL_NAMES,
  V1_RECOMMENDATION_TOOL_NAMES,
  V1_TOOL_CONTRACT,
} from "../src/tool-contract.js";

const plannedToolNames = [
  "etsy_search_public_listings",
  "etsy_get_public_shop",
  "etsy_get_authenticated_user",
  "etsy_get_shop_context",
  "etsy_list_shop_listings",
  "etsy_get_listing_full",
  "etsy_update_listing_content",
  "etsy_update_listing_personalization",
  "etsy_upload_listing_media",
  "etsy_get_receipts",
  "etsy_get_receipt_full",
  "etsy_get_taxonomy_properties",
  "etsy_get_shipping_profiles",
];

describe("V1 MCP tool contract", () => {
  it("lists exactly the planned tools in contract order", () => {
    expect(V1_TOOL_CONTRACT.map((tool) => tool.name)).toEqual(plannedToolNames);
    expect(new Set(V1_TOOL_CONTRACT.map((tool) => tool.name)).size).toBe(V1_TOOL_CONTRACT.length);
  });

  it("defines input and output schemas plus api-client mappings for every tool", () => {
    for (const tool of V1_TOOL_CONTRACT) {
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema.additionalProperties).toBe(false);
      expect(tool.outputSchema.type).toMatch(/^(object|array)$/);
      expect(tool.apiClient.methods.length).toBeGreaterThan(0);
      expect(tool.apiClient.operations.length).toBeGreaterThan(0);
      expect(tool.authScopes).toContain("x-api-key");
      expect(tool.consumers.length).toBeGreaterThan(0);
      expect(tool.testOwner.length).toBeGreaterThan(0);
    }
  });

  it("only marks read-only tools as always_allow for V1 recommendation runs", () => {
    expect(V1_RECOMMENDATION_TOOL_NAMES).toEqual([
      "etsy_search_public_listings",
      "etsy_get_public_shop",
      "etsy_get_authenticated_user",
      "etsy_get_shop_context",
      "etsy_list_shop_listings",
      "etsy_get_listing_full",
      "etsy_get_taxonomy_properties",
      "etsy_get_shipping_profiles",
    ]);

    for (const tool of V1_TOOL_CONTRACT) {
      if (tool.enabledForRecommendationRuns) {
        expect(tool.risk).toBe("read_only");
        expect(tool.permissionPolicy).toBe("always_allow");
      } else {
        expect(tool.permissionPolicy).toBe("disabled_in_v1");
      }
    }
  });

  it("keeps write and read-sensitive tools out of the V1 allow-list", () => {
    expect(V1_DISABLED_TOOL_NAMES).toEqual([
      "etsy_update_listing_content",
      "etsy_update_listing_personalization",
      "etsy_upload_listing_media",
      "etsy_get_receipts",
      "etsy_get_receipt_full",
    ]);

    const unsafeTools = V1_TOOL_CONTRACT.filter((tool) => tool.risk !== "read_only");
    expect(unsafeTools.map((tool) => tool.name)).toEqual(V1_DISABLED_TOOL_NAMES);
    for (const tool of unsafeTools) {
      expect(tool.enabledForRecommendationRuns).toBe(false);
      expect(tool.permissionPolicy).not.toBe("always_allow");
    }
  });

  it("keeps the markdown matrix in sync with the source contract", () => {
    const docs = readFileSync("docs/v1-tool-contract.md", "utf8");
    const documentedNames = [...docs.matchAll(/\| `(etsy_[^`]+)` /g)].map((match) => match[1]);

    expect(documentedNames).toEqual(plannedToolNames);
  });
});
