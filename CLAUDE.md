# Etsy MCP Server - Project Context

## Overview

This is a Model Context Protocol (MCP) server that provides access to the Etsy API through standardized tools. It enables AI assistants and MCP clients to interact with Etsy shops, manage listings, and access seller taxonomy information.

## Project Structure

### Core Files

- `src/index.ts` - Main server entry point with OAuth token management
- `src/config.ts` - Configuration loading from environment variables or settings file
- `src/handlers/` - Tool handlers organized by functionality:
  - `shop.ts` - Shop information and sections
  - `listing.ts` - Listing management (create, update, images, inventory)
  - `seller-taxonomy.ts` - Product taxonomy and properties

### Configuration

- **Settings File**: `etsy_mcp_settings.json` (use `etsy_mcp_settings.example.json` as template)
- **Environment Variables**: `ETSY_API_KEY`, `ETSY_SHARED_SECRET`, `ETSY_REFRESH_TOKEN`
- **OAuth Helper**: `src/get-refresh-token.ts` - Interactive script to obtain refresh tokens

### Development Setup

```bash
npm install           # Install dependencies
npm run build         # Build TypeScript to ./build/
npm run watch         # Auto-rebuild on changes
npm start             # Start the MCP server
npm run inspector     # Launch MCP Inspector for debugging
```

### Testing

```bash
npm test              # Run test suite with Vitest
npm run lint          # ESLint with TypeScript rules
npm run format        # Prettier formatting
```

## Available Tools

### Shop Tools

- `getMe` - Get authenticated user info (returns user_id and shop_id)
- `getShop(shop_id)` - Get shop information
- `getShopSections(shop_id)` - List shop sections

### Listing Tools

- `getListingsByShop(shop_id, state?)` - List shop listings (states: active, draft, etc.)
- `createDraftListing(shop_id, title, description, price, quantity, who_made, when_made, taxonomy_id)` - Create new listing
- `updateListing(shop_id, listing_id, title?, description?, price?)` - Update existing listing
- `uploadListingImage(shop_id, listing_id, image_path)` - Upload listing image
- `getListingImages(listing_id)` - Get listing images
- `getListingFiles(listing_id)` - Get digital listing files
- `getListingInventory(listing_id)` - Get inventory details
- `updateListingInventory(listing_id, products)` - Update inventory

### Taxonomy Tools

- `getSellerTaxonomyNodes()` - Get full taxonomy hierarchy
- `getPropertiesByTaxonomyId(taxonomy_id)` - Get properties for taxonomy node

## Key Implementation Details

### Authentication

- Uses OAuth 2.0 refresh token flow
- Automatically refreshes access tokens as needed
- API key required in headers for all requests

### MCP Integration

- Communicates over stdio using MCP protocol
- Tools defined with JSON schemas for validation
- Error handling for Etsy API responses and network issues

### Docker Support

- Dockerfile included for containerized deployment
- Supports both environment variables and mounted settings file
- Designed for MCP client integration, not standalone operation

## Common Workflows

### Getting Started

1. Obtain Etsy API credentials from developers.etsy.com
2. Run `npx tsx src/get-refresh-token --keystring YOUR_KEY --shared-secret YOUR_SECRET`
3. Create `etsy_mcp_settings.json` with credentials
4. Build and test with MCP Inspector: `npm run build && npm run inspector`

### Typical Shop Management

1. Use `getMe` to get your shop_id
2. Use `getListingsByShop` to see current listings
3. Use `createDraftListing` for new products
4. Use `uploadListingImage` to add product photos
5. Use `updateListing` to modify existing listings

### Development Notes

- TypeScript with strict mode enabled
- ES2022 target with Node18 module resolution
- Vitest for testing, ESLint + Prettier for code quality
- All API responses returned as formatted JSON strings to MCP clients
