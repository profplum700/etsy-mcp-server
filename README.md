# etsy-mcp-server MCP Server

MCP server for the Etsy API. See https://developers.etsy.com/documentation/reference

This is a TypeScript-based MCP server that implements a simple notes system. It demonstrates core MCP concepts by providing:

- Resources representing text notes with URIs and metadata
- Tools for creating new notes
- Prompts for generating summaries of notes

## Features

### Resources
- List and access notes via `note://` URIs
- Each note has a title, content and metadata
- Plain text mime type for simple content access

### Tools
- `create_note` - Create new text notes
  - Takes title and content as required parameters
  - Stores note in server state

### Prompts
- `summarize_notes` - Generate a summary of all stored notes
  - Includes all note contents as embedded resources
  - Returns structured prompt for LLM summarization

## Development

Install dependencies:
```bash
npm install
```

Build the server:
```bash
npm run build
```

For development with auto-rebuild:
```bash
npm run watch
```

## Configuration

Copy `cline_mcp_settings.example.json` to `cline_mcp_settings.json` and replace
the placeholder values with your Etsy API credentials:

```bash
cp cline_mcp_settings.example.json cline_mcp_settings.json
# then edit cline_mcp_settings.json
```

The server reads these values when the `ETSY_API_KEY`, `ETSY_SHARED_SECRET`, and
`ETSY_REFRESH_TOKEN` environment variables are not set.

You can instead set those environment variables directly when launching the
server if you prefer not to store a local settings file.

## Installation

To use with Claude Desktop, add the server config:

On MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "etsy-mcp-server": {
      "command": "/path/to/etsy-mcp-server/build/index.js"
    }
  }
}
```

### Debugging

Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), which is available as a package script:

```bash
npm run inspector
```

The Inspector will provide a URL to access debugging tools in your browser.
