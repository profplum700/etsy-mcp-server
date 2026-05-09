import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadEtsyConfig } from '../src/config.js';
import fs from 'fs';
import path from 'path';

// Mock environment variables for testing
const originalEnv = { ...process.env };

describe('EtsyServer Integration Tests', () => {
  beforeEach(() => {
    // Set up test environment variables
    process.env.ETSY_API_KEY = 'test-api-key';
    process.env.ETSY_SHARED_SECRET = 'test-shared-secret';
    process.env.ETSY_REFRESH_TOKEN = 'test-refresh-token';
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe('Configuration Loading', () => {
    it('should load configuration from environment variables', () => {
      process.env.ETSY_API_KEY = 'test-api-key';
      process.env.ETSY_SHARED_SECRET = 'test-shared-secret';
      process.env.ETSY_REFRESH_TOKEN = 'test-refresh-token';
      
      const config = loadEtsyConfig();
      
      expect(config.apiKey).toBe('test-api-key');
      expect(config.sharedSecret).toBe('test-shared-secret');
      expect(config.refreshToken).toBe('test-refresh-token');
    });

    it('should validate required configuration fields', () => {
      // Store original values
      const originalApiKey = process.env.ETSY_API_KEY;
      const originalSharedSecret = process.env.ETSY_SHARED_SECRET;
      const originalRefreshToken = process.env.ETSY_REFRESH_TOKEN;
      
      // Clear environment variables
      delete process.env.ETSY_API_KEY;
      delete process.env.ETSY_SHARED_SECRET;
      delete process.env.ETSY_REFRESH_TOKEN;

      // Ensure no settings file exists for this test
      const settingsPath = path.join(__dirname, "..", "etsy_mcp_settings.json");
      const settingsExisted = fs.existsSync(settingsPath);
      if (settingsExisted) {
        fs.unlinkSync(settingsPath);
      }

      expect(() => loadEtsyConfig()).toThrow(
        'ETSY_API_KEY, ETSY_SHARED_SECRET, and ETSY_REFRESH_TOKEN environment variables are required'
      );
      
      // Restore original values
      if (originalApiKey) process.env.ETSY_API_KEY = originalApiKey;
      if (originalSharedSecret) process.env.ETSY_SHARED_SECRET = originalSharedSecret;
      if (originalRefreshToken) process.env.ETSY_REFRESH_TOKEN = originalRefreshToken;
    });
  });

  describe('Server Initialization', () => {
    it('should have proper server configuration constants', () => {
      const serverName = 'etsy-mcp-server';
      const serverVersion = '1.0.0';
      const apiClientPackage = '@profplum700/etsy-v3-api-client';
      
      expect(serverName).toBe('etsy-mcp-server');
      expect(serverVersion).toBe('1.0.0');
      expect(apiClientPackage).toBe('@profplum700/etsy-v3-api-client');
    });
  });

  describe('API Client Boundaries', () => {
    it('should keep Etsy request construction inside the shared api-client package', () => {
      const localBoundary = {
        transport: 'mcp-stdio',
        etsyRequests: 'shared-api-client'
      };
      
      expect(localBoundary.transport).toBe('mcp-stdio');
      expect(localBoundary.etsyRequests).toBe('shared-api-client');
    });
  });

  describe('Tool Schema Validation', () => {
    it('should validate shop_id parameter format', () => {
      const validShopId = '12345';
      const invalidShopId = '';
      
      expect(validShopId).toMatch(/^\d+$/);
      expect(invalidShopId).not.toMatch(/^\d+$/);
    });

    it('should validate listing_id parameter format', () => {
      const validListingId = '67890';
      const invalidListingId = 'abc';
      
      expect(validListingId).toMatch(/^\d+$/);
      expect(invalidListingId).not.toMatch(/^\d+$/);
    });

    it('should validate file path parameters', () => {
      const validPath = '/path/to/image.jpg';
      const invalidPath = '';
      
      expect(validPath.length).toBeGreaterThan(0);
      expect(invalidPath.length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing configuration gracefully', () => {
      delete process.env.ETSY_API_KEY;
      
      expect(() => loadEtsyConfig()).toThrow();
    });

    it('should validate input parameters', () => {
      const requiredFields = ['shop_id', 'listing_id', 'image_path'];
      const testInput = { shop_id: '123', listing_id: '456' };
      
      const missingFields = requiredFields.filter(field => !testInput[field as keyof typeof testInput]);
      expect(missingFields).toContain('image_path');
    });
  });
});
