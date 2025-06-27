import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export interface EtsyConfig {
  apiKey: string;
  sharedSecret: string;
  refreshToken: string;
}

export function loadEtsyConfig(): EtsyConfig {
  let apiKey: string | undefined;
  let sharedSecret: string | undefined;
  let refreshToken: string | undefined;

  // First, try to load from settings file
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const settingsPath = path.join(__dirname, '..', 'etsy_mcp_settings.json');
    const raw = fs.readFileSync(settingsPath, 'utf-8');
    const cfg = JSON.parse(raw)["etsy-mcp-server"] ?? {};
    apiKey = cfg.keystring;
    sharedSecret = cfg.sharedSecret;
    refreshToken = cfg.refreshToken;
  } catch {
    // File doesn't exist or is invalid, continue to environment variables
  }

  // Fall back to environment variables if not loaded from file
  apiKey = apiKey || process.env.ETSY_API_KEY;
  sharedSecret = sharedSecret || process.env.ETSY_SHARED_SECRET;
  refreshToken = refreshToken || process.env.ETSY_REFRESH_TOKEN;

  if (!apiKey || !sharedSecret || !refreshToken) {
    throw new Error(
      'ETSY_API_KEY, ETSY_SHARED_SECRET, and ETSY_REFRESH_TOKEN must be provided either via environment variables or in etsy_mcp_settings.json'
    );
  }

  return {
    apiKey,
    sharedSecret,
    refreshToken,
  };
}
