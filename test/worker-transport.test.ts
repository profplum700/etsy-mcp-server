import { describe, expect, it } from "vitest";
import worker, { handleWorkerRequest, type WorkerEnv } from "../src/worker.js";

const env: WorkerEnv = {
  ETSY_API_KEY: "test-api-key",
  ETSY_SHARED_SECRET: "test-shared-secret",
  ETSY_REFRESH_TOKEN: "test-refresh-token",
};

function mcpRequest(body: unknown): Request {
  return new Request("https://worker.test/mcp", {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("Worker Streamable HTTP transport", () => {
  it("serves a generic health probe without Etsy credentials in the response", async () => {
    const response = await handleWorkerRequest(new Request("https://worker.test/healthz"), env);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      name: "etsy-mcp-server",
      transport: "streamable-http",
      endpoint: "/mcp",
    });
  });

  it("performs a Streamable HTTP MCP initialize handshake", async () => {
    const response = await worker.fetch(
      mcpRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "worker-smoke", version: "1.0.0" },
        },
      }),
      env
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = await response.json();
    expect(body).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        serverInfo: { name: "etsy-mcp-server", version: "1.0.0" },
      },
    });
    expect(body.result.capabilities.tools).toEqual({});
  });

  it("returns 404 outside the planned MCP endpoint", async () => {
    const response = await handleWorkerRequest(new Request("https://worker.test/not-mcp"), env);

    expect(response.status).toBe(404);
  });
});
