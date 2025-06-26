import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadEtsyConfig } from '../src/config.js';

const settingsPath = path.join(__dirname, '..', 'cline_mcp_settings.json');

function cleanup() {
  if (fs.existsSync(settingsPath)) {
    fs.unlinkSync(settingsPath);
  }
}

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  cleanup();
});

describe('loadEtsyConfig', () => {
  it('uses environment variables when set', () => {
    process.env.ETSY_API_KEY = 'key';
    process.env.ETSY_SHARED_SECRET = 'secret';
    process.env.ETSY_REFRESH_TOKEN = 'token';
    const cfg = loadEtsyConfig();
    expect(cfg).toEqual({ apiKey: 'key', sharedSecret: 'secret', refreshToken: 'token' });
  });

  it('reads from config file when env vars missing', () => {
    const data = {
      'etsy-mcp-server': {
        keystring: 'k',
        sharedSecret: 's',
        refreshToken: 'r',
      },
    };
    fs.writeFileSync(settingsPath, JSON.stringify(data));
    delete process.env.ETSY_API_KEY;
    delete process.env.ETSY_SHARED_SECRET;
    delete process.env.ETSY_REFRESH_TOKEN;
    const cfg = loadEtsyConfig();
    expect(cfg).toEqual({ apiKey: 'k', sharedSecret: 's', refreshToken: 'r' });
  });

  it('throws if config missing', () => {
    delete process.env.ETSY_API_KEY;
    delete process.env.ETSY_SHARED_SECRET;
    delete process.env.ETSY_REFRESH_TOKEN;
    expect(() => loadEtsyConfig()).toThrow(
      'ETSY_API_KEY, ETSY_SHARED_SECRET, and ETSY_REFRESH_TOKEN environment variables are required'
    );
  });
});
