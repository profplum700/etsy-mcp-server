import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { handleWorkerRequest, type WorkerEnv } from "../src/worker.js";

const bearer = ["test", "worker", "secret"].join("-");
const env: WorkerEnv = {
  ETSY_API_KEY: "test-api-key",
  ETSY_SHARED_SECRET: "test-shared-secret",
  ETSY_REFRESH_TOKEN: "test-refresh-token",
  MCP_BEARER: bearer,
};

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

const initializeBody = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "worker-smoke", version: "1.0.0" },
  },
};

async function expectUnauthorized(response: Response, leakedValue: string): Promise<void> {
  expect(response.status).toBe(401);
  const text = await response.text();
  expect(text).toContain("Unauthorized");
  expect(text).not.toContain(leakedValue);
  expect(response.headers.get("www-authenticate") ?? "").not.toContain(leakedValue);
}

describe("Worker Streamable HTTP transport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("serves a generic health probe without requiring bearer auth", async () => {
    const response = await handleWorkerRequest(new Request("https://worker.test/healthz"), env);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      name: "etsy-mcp-server",
      transport: "streamable-http",
      endpoint: "/mcp",
    });
  });

  it("rejects missing bearer auth before MCP processing", async () => {
    const response = await handleWorkerRequest(mcpRequest(initializeBody), env);

    await expectUnauthorized(response, bearer);
  });

  it("rejects malformed bearer auth before MCP processing", async () => {
    const malformed = `Token ${bearer}`;
    const response = await handleWorkerRequest(mcpRequest(initializeBody, malformed), env);

    await expectUnauthorized(response, malformed);
  });

  it("rejects invalid bearer auth before tool execution", async () => {
    const invalidBearer = ["wrong", "worker", "secret"].join("-");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const response = await handleWorkerRequest(
      mcpRequest(
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "getShop", arguments: { shop_id: "123" } },
        },
        `Bearer ${invalidBearer}`
      ),
      env
    );

    await expectUnauthorized(response, invalidBearer);
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
  });

  it("performs a Streamable HTTP MCP initialize handshake with valid bearer auth", async () => {
    const response = await worker.fetch(mcpRequest(initializeBody, `Bearer ${bearer}`), env);

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
