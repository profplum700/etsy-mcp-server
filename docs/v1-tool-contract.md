# V1 MCP tool contract

This document is the durable contract for the first generic Etsy MCP tool
surface. It is intentionally a contract only: individual tool handlers may land
in later changes, but they must not drift from the TypeScript source of truth in
`src/tool-contract.ts`.

The contract maps to the api-client V1 endpoint coverage matrix introduced in
`@profplum700/etsy-v3-api-client` and to its pinned Etsy OpenAPI snapshot
`spec/etsy-openapi-3.0.0-2026-05-10.json`. The server remains generic: no
shop-specific names, IDs, prompts, private hostnames, or deployment values belong
in this repository.

## Permission policy

- `always_allow`: read-only tools that are safe for unattended recommendation
  runs.
- `disabled_in_v1`: read-sensitive or write-capable tools that must not be
  registered for unattended recommendation runs. Write tools may only be enabled
  in a later approved execution flow with explicit gating.

## Tool matrix

| Tool                                  | Class               | V1 recommendation policy | api-client surface                                                           | Output shape owner            |
| ------------------------------------- | ------------------- | ------------------------ | ---------------------------------------------------------------------------- | ----------------------------- |
| `etsy_search_public_listings`         | read-only           | `always_allow`           | `EtsyClient.findAllListingsActive`                                           | read-tool implementation      |
| `etsy_get_public_shop`                | read-only           | `always_allow`           | `EtsyClient.getShop`                                                         | tool contract                 |
| `etsy_get_authenticated_user`         | read-only           | `always_allow`           | `EtsyClient.getUser` / `EtsyClient.getMe`                                    | tool contract                 |
| `etsy_get_shop_context`               | read-only composite | `always_allow`           | `EtsyClient.getUser` / `EtsyClient.getShop`                                  | read-tool implementation      |
| `etsy_list_shop_listings`             | read-only           | `always_allow`           | `EtsyClient.getListingsByShop`                                               | read-tool implementation      |
| `etsy_get_listing_full`               | read-only           | `always_allow`           | `EtsyClient.getListing` / `EtsyClient.getListingInventory`                   | read-tool implementation      |
| `etsy_update_listing_content`         | deferred write      | `disabled_in_v1`         | `EtsyClient.updateListing`                                                   | deferred-write harness        |
| `etsy_update_listing_personalization` | deferred write      | `disabled_in_v1`         | `EtsyClient.updateListingPersonalization`                                    | deferred-write harness        |
| `etsy_upload_listing_media`           | deferred write      | `disabled_in_v1`         | `EtsyClient.uploadListingImage` / `uploadListingFile` / `uploadListingVideo` | deferred-write harness        |
| `etsy_get_receipts`                   | read-sensitive      | `disabled_in_v1`         | `EtsyClient.getShopReceipts`                                                 | read-sensitive harness        |
| `etsy_get_receipt_full`               | read-sensitive      | `disabled_in_v1`         | `EtsyClient.getShopReceipt`                                                  | read-sensitive harness        |
| `etsy_get_taxonomy_properties`        | read-only           | `always_allow`           | `EtsyClient.getPropertiesByTaxonomyId`                                       | reference-tool implementation |
| `etsy_get_shipping_profiles`          | read-only           | `always_allow`           | `EtsyClient.getShopShippingProfiles`                                         | reference-tool implementation |

## Implementation rules

1. Registered tool names, descriptions, input schemas, output schemas,
   read/write classification, and permission-policy recommendations must come
   from `src/tool-contract.ts` or a generated derivative of it.
2. No tool with `risk: "deferred_write"` may be marked `always_allow` or enabled
   for unattended V1 recommendation runs.
3. No tool with `risk: "read_sensitive"` may be enabled for unattended V1
   recommendation runs without a new contract change that explains the data
   exposure and required prompt policy.
4. Tool handlers must call `@profplum700/etsy-v3-api-client` through the local
   api-client adapter. They must not construct Etsy HTTP requests directly.
5. Tool responses should be bounded JSON objects/arrays that do not include
   bearer tokens, OAuth tokens, API keys, or deployment-specific diagnostics.
