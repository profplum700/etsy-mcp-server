import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export interface EtsyConfig {
  apiKey: string;
  sharedSecret: string;
  refreshToken: string;
}

export function loadEtsyConfig(): EtsyConfig {
  let apiKey: string | undefined = process.env.ETSY_API_KEY;
  let sharedSecret: string | undefined = process.env.ETSY_SHARED_SECRET;
  let refreshToken: string | undefined = process.env.ETSY_REFRESH_TOKEN;

  if (!apiKey || !sharedSecret || !refreshToken) {
    try {
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const settingsPath = path.join(__dirname, '..', 'etsy_mcp_settings.json');
      const raw = fs.readFileSync(settingsPath, 'utf-8');
      const cfg = JSON.parse(raw)["etsy-mcp-server"] ?? {};
      apiKey = apiKey || cfg.keystring;
      sharedSecret = sharedSecret || cfg.sharedSecret;
      refreshToken = refreshToken || cfg.refreshToken;
    } catch {
      // ignore – handled below if still undefined
    }
  }

  if (!apiKey || !sharedSecret || !refreshToken) {
    throw new Error(
      'ETSY_API_KEY, ETSY_SHARED_SECRET, and ETSY_REFRESH_TOKEN environment variables are required'
    );
  }

  return {
    apiKey,
    sharedSecret,
    refreshToken,
  };
}
