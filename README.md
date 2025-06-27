# Etsy MCP Server

This project exposes a subset of the [Etsy API](https://developers.etsy.com/) through the Model Context Protocol. It allows tools to be called from an MCP client to retrieve shop data and manage listings.

## OAuth Setup

The server requires a valid Etsy API keystring, shared secret, and OAuth refresh token. You can provide these credentials in two ways:

1.  **Environment Variables**: Set `ETSY_API_KEY`, `ETSY_SHARED_SECRET`, and `ETSY_REFRESH_TOKEN`.
2.  **Settings File**: Create an `etsy_mcp_settings.json` file by copying `etsy_mcp_settings.example.json` and filling in your credentials.

If you do not yet have a refresh token, run the following helper script:

```bash
npx tsx src/get-refresh-token --keystring YOUR_KEY --shared-secret YOUR_SECRET
```

The script opens a browser window for authentication and prints the refresh token to the console.

## Local Development

These instructions are for running the server directly on your machine for development purposes.

First, install dependencies:

```bash
npm install
```

Then, build the server:

```bash
npm run build
```

You can also use `npm run watch` to automatically rebuild the server when you make code changes.

### Configuration File Location

For local development, place your `etsy_mcp_settings.json` file in the project root directory (same level as `package.json`). The server will automatically detect and load it.

### Running the Server

After building, start the server with:

```bash
npm start
```

**Important**: This MCP server communicates over stdio and is designed to be connected to by MCP clients (like Claude Desktop, Cline, or other MCP-compatible applications). When run directly, it will start and wait for MCP protocol messages. To test functionality, use the MCP Inspector (see Debugging section) or connect it to an MCP client.

### MCP Client Integration

To use this server with an MCP client, you typically need to:

1. **Claude Desktop**: Add the server configuration to your Claude Desktop settings
2. **Cline**: Configure the server in your MCP server settings
3. **Other MCP Clients**: Refer to your client's documentation for adding MCP servers

The server will be started automatically by the MCP client when needed.

## Running with Docker

This is the recommended method for deployment or for running the server in a standardized environment.

First, build the Docker image from the repository root:

```bash
docker build -t etsy-mcp-server .
```

### Configuration File Location for Docker

For Docker usage, your `etsy_mcp_settings.json` file should be located in the same directory where you run the `docker run` command. The `./` in the volume mount refers to your current working directory.

### Container Behavior

**Important**: MCP servers are not long-running background services. When you start the container, it will:

1. Load your Etsy credentials (from environment variables or settings file)
2. Print "Etsy MCP server running on stdio"
3. Wait for MCP protocol messages on stdin
4. Exit after a short time if no MCP client connects

This is normal behavior. The container is designed to be started by MCP clients when needed, not to run continuously like a web server.

### Starting the Container

You can supply your Etsy credentials either as environment variables or by mounting your settings file.

**Option 1: Using Environment Variables**

```bash
docker run --rm \
  -e ETSY_API_KEY=YOUR_KEY \
  -e ETSY_SHARED_SECRET=YOUR_SECRET \
  -e ETSY_REFRESH_TOKEN=YOUR_TOKEN \
  etsy-mcp-server
```

**Option 2: Using a Settings File**

Create an `etsy_mcp_settings.json` file in your current directory. Then, mount it into the container using the `-v` flag:

```bash
docker run --rm \
  -v ./etsy_mcp_settings.json:/usr/src/app/etsy_mcp_settings.json \
  etsy-mcp-server
```

### MCP Client Integration with Docker

To use this Docker container with MCP clients:

1. **Claude Desktop**: Configure the server to use the Docker command in your Claude Desktop settings
2. **Cline**: Set up the Docker command as your MCP server startup command
3. **Other MCP Clients**: Use the appropriate Docker command as the server executable

Example MCP client configuration:

```json
{
  "command": "docker",
  "args": [
    "run",
    "--rm",
    "-v",
    "./etsy_mcp_settings.json:/usr/src/app/etsy_mcp_settings.json",
    "etsy-mcp-server"
  ]
}
```

The MCP client will automatically start the container when it needs to use the Etsy tools and stop it when done.

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

### Using the MCP Inspector

For debugging and testing the server functionality, use the MCP Inspector with the **local development setup**:

```bash
npm run inspector
```

The inspector will:

1. Start a proxy server and web interface
2. Launch the locally built MCP server
3. Provide a URL to view communication logs and test tools interactively

**Important**: The MCP Inspector only works with the local development setup, not with Docker. This is because:

- Docker containers start and exit quickly when no MCP client connects
- The inspector needs direct access to the server process
- Network isolation prevents the inspector from communicating with containerized servers

### Recommended Debugging Workflow

1. **For Development and Testing**: Use local development with the MCP Inspector

   ```bash
   npm run build
   npm run inspector
   ```

2. **For Deployment**: Use Docker with MCP clients
   ```bash
   docker build -t etsy-mcp-server .
   # Then use with your MCP client
   ```

This approach gives you the best of both worlds: interactive debugging locally and reliable deployment with Docker.
