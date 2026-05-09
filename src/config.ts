import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export interface EtsyConfig {
  apiKey: string;
  sharedSecret: string;
  refreshToken: string;
}

function resolveSettingsPath(): string {
  return (
    process.env.ETSY_MCP_SETTINGS_PATH ||
    path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "etsy_mcp_settings.json")
  );
}

export function loadEtsyConfig(): EtsyConfig {
  // 1. Prefer values supplied via environment variables
  let apiKey: string | undefined = process.env.ETSY_API_KEY;
  let sharedSecret: string | undefined = process.env.ETSY_SHARED_SECRET;
  let refreshToken: string | undefined = process.env.ETSY_REFRESH_TOKEN;

  // 2. When any value is missing, attempt to read from the optional settings file
  if (!apiKey || !sharedSecret || !refreshToken) {
    try {
      const settingsPath = resolveSettingsPath();
      if (fs.existsSync(settingsPath)) {
        const raw = fs.readFileSync(settingsPath, "utf-8");
        const cfg = JSON.parse(raw)["etsy-mcp-server"] ?? {};
        // Only fill in values that are currently undefined so that env vars always win
        apiKey = apiKey || cfg.keystring;
        sharedSecret = sharedSecret || cfg.sharedSecret;
        refreshToken = refreshToken || cfg.refreshToken;
      }
    } catch {
      // The file is optional – ignore if it is missing or malformed
    }
  }

  // 3. Validate that we now have all required configuration pieces
  if (!apiKey || !sharedSecret || !refreshToken) {
    throw new Error(
      "ETSY_API_KEY, ETSY_SHARED_SECRET, and ETSY_REFRESH_TOKEN environment variables are required"
    );
  }

  return {
    apiKey,
    sharedSecret,
    refreshToken,
  };
}
