# Etsy MCP Server

This project exposes a subset of the [Etsy API](https://developers.etsy.com/) through the Model Context Protocol. It allows tools to be called from an MCP client to retrieve shop data and manage listings.

## OAuth setup

The server requires a valid Etsy API keystring, shared secret and OAuth refresh token. You can supply them via the `ETSY_API_KEY`, `ETSY_SHARED_SECRET` and `ETSY_REFRESH_TOKEN` environment variables or by creating a `cline_mcp_settings.json` file based on `cline_mcp_settings.example.json`.

If you do not yet have a refresh token, run the helper script:

```bash
npx tsx src/get-refresh-token --keystring YOUR_KEY --shared-secret YOUR_SECRET
```

The script opens a browser window for authentication and prints the refresh token to the console.

## Development

Install dependencies and build the server:

```bash
npm install
npm run build
```

During development you can auto rebuild with:

```bash
npm run watch
```

## Running

After building, start the server with:

```bash
node build/index.js
```

## Available tools

### `getShop`

Fetch information about a shop.
Required argument: `shop_id`.

### `getMe`
Return basic info about the authenticated user, including `user_id` and
`shop_id`. This endpoint takes no arguments.

### `getListingsByShop`

List the listings in a shop. Supports an optional `state` parameter (e.g. `active`, `draft`). Requires `shop_id`.

### `createDraftListing`

Create a new physical draft listing using `POST /v3/application/shops/{shop_id}/listings`.
The tool accepts all fields supported by Etsy's `createDraftListing` endpoint.

### `uploadListingImage`

Upload an image to a listing. Requires `shop_id`, `listing_id` and `image_path`.
(Implementation is currently a placeholder.)

### `updateListing`

Update an existing listing. Requires `shop_id` and `listing_id`. Optional fields include `title`, `description` and `price`.

### `getShopReceipts`

Retrieve receipts for a shop. Requires `shop_id`.

### `getShopSections`
Retrieve the list of sections in a shop. Requires `shop_id`.

### `getShopSection`
Retrieve a single shop section by `shop_id` and `shop_section_id`.

## Debugging

The server communicates over stdio. For debugging you can launch it with the MCP Inspector:

```bash
npm run inspector
```

The inspector prints a URL that you can open in a browser to view communication logs and inspect messages.
