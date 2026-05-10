# Worker Deployment and OAuth Consent Runbook

This runbook describes a generic self-hosted deployment of the Etsy MCP Server
Worker endpoint. It intentionally uses placeholders only. Keep real Etsy
credentials, bearer tokens, deployed URLs, account IDs, and shop-specific values
outside this repository.

The local `npm start` path remains a stdio MCP server. This document covers the
Cloudflare Worker Streamable HTTP path exposed by `src/worker.ts`.

## Runtime endpoints

Default endpoints:

- `GET /healthz` is public and returns a non-secret health response.
- `POST /mcp` accepts MCP Streamable HTTP JSON-RPC requests.
- `GET /mcp` supports Streamable HTTP SSE requests when the MCP client requests
  `text/event-stream`.
- `DELETE /mcp` accepts MCP Streamable HTTP session termination requests.

All `/mcp` methods require `Authorization: Bearer <token>`. The Worker compares
that token with the `MCP_BEARER` secret before creating an MCP server or running
any tool handler.

## Required deployment inputs

Use your own secret store or `wrangler secret put` for real values. Do not commit
real values to `wrangler.toml`, README files, examples, issue trackers, or logs.

| Name | Kind | Purpose |
| --- | --- | --- |
| `ETSY_API_KEY` | Secret | Etsy app keystring used by the api-client. |
| `ETSY_SHARED_SECRET` | Secret | Etsy app shared secret used by OAuth refresh. |
| `ETSY_REFRESH_TOKEN` | Secret or token-vault seed | One-time OAuth refresh token for the Etsy account that consented to read scopes. |
| `MCP_BEARER` | Secret | Shared bearer token required by MCP clients when calling `/mcp`. |
| `MCP_ENDPOINT` | Var | Optional path override; defaults to `/mcp`. |
| `ETSY_TOKEN_VAULT` | Durable Object binding, optional advanced mode | Token vault binding when a deployment wires the api-client `TokenVaultClient` / `DurableObjectTokenVault` instead of a static refresh-token secret. |

The checked-in Worker currently accepts `ETSY_REFRESH_TOKEN` directly and lets
the api-client refresh access tokens as needed. Deployments that use the
api-client Durable Object token vault should bind the Durable Object and construct
a `TokenVaultClient` TokenProvider in their Worker entrypoint. In either mode,
the MCP server should receive tokens through the api-client TokenProvider
abstraction, not through ad hoc Etsy HTTP or OAuth code.

## One-time Etsy OAuth consent bootstrap

Run the OAuth helper from a trusted local machine or a temporary operator host.
The helper requests read scopes used by the V1 MCP tools: `shops_r`,
`listings_r`, and `transactions_r`.

1. Register the local callback URL in your Etsy app settings:
   `http://localhost:3030/oauth/redirect`.
2. Install dependencies and run the helper:

   ```bash
   npm install
   npx tsx src/get-refresh-token \
     --keystring "<ETSY_API_KEY>" \
     --shared-secret "<ETSY_SHARED_SECRET>"
   ```

3. Complete the Etsy consent screen in the browser for the account that owns the
   target shop.
4. Copy the refresh token into your deployment secret store or seed it into the
   token vault. Treat the printed access token and refresh token as sensitive;
   do not paste them into chat, tickets, source control, or CI logs.
5. Remove any temporary local shell history or terminal transcript that contains
   token values.

If you use a different helper port, register the exact callback URL with Etsy and
pass `--port <PORT>` to the helper.

## Cloudflare Worker deployment

Install and build from a clean checkout:

```bash
npm install
npm run build
cp wrangler.toml.example wrangler.toml
```

Review `wrangler.toml` and keep only generic names in the file. Prefer secrets
for sensitive values:

```bash
wrangler secret put MCP_BEARER
wrangler secret put ETSY_API_KEY
wrangler secret put ETSY_SHARED_SECRET
wrangler secret put ETSY_REFRESH_TOKEN
```

If you need a non-default MCP path, set `MCP_ENDPOINT` as a plain variable, for
example `/mcp`. Keep the path stable once MCP clients are configured.

Deploy after the build passes:

```bash
npm run build
wrangler deploy --config wrangler.toml
```

Record the deployed Worker URL in your private operational notes only. Do not add
private hostnames to this public repository.

## Durable Object token vault setup

For deployments that choose Durable Object-backed token storage:

1. Use the api-client Worker-safe exports for `DurableObjectTokenVault` and
   `TokenVaultClient`.
2. Add a Durable Object binding such as `ETSY_TOKEN_VAULT` in the deployment
   configuration and run the required Wrangler migration for that class.
3. Seed the one-time OAuth token bundle into the vault through an operator-only
   bootstrap route or script. Disable or protect that bootstrap path after use.
4. Configure the MCP Worker to build its Etsy api-client with a TokenProvider
   backed by `TokenVaultClient`.
5. Verify concurrent refresh behavior with a read-only MCP smoke request. The
   vault should serialize refreshes and reject stale overwrites; the MCP layer
   should only observe a valid access token or a secret-safe authentication
   error.

A static `ETSY_REFRESH_TOKEN` secret is simpler for a single self-hosted Worker,
but it does not provide shared persistent token state across isolates. Use the
Durable Object vault when multiple Worker instances may refresh the same token
bundle or when refresh history must survive isolate restarts.

## Bearer setup and rotation

Generate a high-entropy bearer value outside this repository, then store it as
`MCP_BEARER`.

Rotation procedure:

1. Generate a new bearer value.
2. Update the Worker secret:

   ```bash
   wrangler secret put MCP_BEARER
   ```

3. Deploy or allow the platform secret update to roll out.
4. Update the MCP client or private integration secret to the new value.
5. Run the health and MCP handshake checks below.
6. Remove the old value from all client secret stores.

Never log the bearer token. Failed `/mcp` requests return HTTP 401 without
running tools and without echoing the presented token.

## Health and read-only smoke checks

Use placeholders below. Replace `https://mcp.example.invalid` with your deployed
Worker base URL in a private shell or secret-aware runbook.

Public health check:

```bash
curl -fsS https://mcp.example.invalid/healthz
```

Expected shape:

```json
{
  "ok": true,
  "name": "etsy-mcp-server",
  "transport": "streamable-http",
  "endpoint": "/mcp"
}
```

MCP initialize handshake:

```bash
curl -fsS https://mcp.example.invalid/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H "authorization: Bearer <MCP_BEARER>" \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke-client","version":"0.0.0"}}}'
```

Read-only tool-list smoke:

```bash
curl -fsS https://mcp.example.invalid/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H "authorization: Bearer <MCP_BEARER>" \
  --data '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

A successful tool list should include V1 read tools such as
`etsy_get_shop_context`, `etsy_list_shop_listings`, `etsy_get_listing_full`,
`etsy_get_taxonomy_properties`, and `etsy_get_shipping_profiles`. Deferred write
tools should not be required for V1 recommendation runs.

Optional authenticated read smoke, after verifying the consented account:

```bash
curl -fsS https://mcp.example.invalid/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H "authorization: Bearer <MCP_BEARER>" \
  --data '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"etsy_get_authenticated_user","arguments":{}}}'
```

Do not run Etsy write probes for V1 deployment validation.

## Rollback

If the Worker deploy is unhealthy:

1. Stop private MCP clients from sending new work.
2. Check `GET /healthz` and a bearer-protected `tools/list` request.
3. Inspect platform logs for secret-safe errors only; do not print bearer or
   OAuth values.
4. Roll back to the last known-good Worker deployment with Wrangler or the
   Cloudflare dashboard.
5. Re-run health and MCP handshakes.
6. If token refresh caused the incident, rotate `MCP_BEARER` only if the bearer
   may have leaked; otherwise restore or reseed the Etsy token bundle and re-run
   read-only smoke checks.

## Private integration checklist

Before a private application points Managed Agents or another MCP client at the
Worker, record these values in that application's secret/config store only:

- Worker base URL, for example `https://mcp.example.invalid`.
- MCP endpoint path, usually `/mcp`.
- `MCP_BEARER` value or secret reference.
- Confirmation that the Etsy account consented to `shops_r`, `listings_r`, and
  `transactions_r`.
- Token storage mode: static `ETSY_REFRESH_TOKEN` secret or Durable Object token
  vault binding.
- Read-only smoke evidence: health response, initialize response, and tool list
  response.
- Rollback target or last known-good deployment identifier.

Keep shop-specific identifiers, customer/order data, recommendation artifacts,
and deployment hostnames in the private system, not in this public repo.
