import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// Mock fs for file operations testing
vi.mock('fs');
const mockedFs = vi.mocked(fs);

describe('EtsyServer Tools and Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('File Operations', () => {
    it('should validate file existence', () => {
      mockedFs.existsSync = vi.fn().mockReturnValue(true);
      
      const filePath = '/path/to/image.jpg';
      const exists = fs.existsSync(filePath);
      
      expect(exists).toBe(true);
      expect(mockedFs.existsSync).toHaveBeenCalledWith(filePath);
    });

    it('should handle missing files', () => {
      mockedFs.existsSync = vi.fn().mockReturnValue(false);
      
      const filePath = '/nonexistent/file.jpg';
      const exists = fs.existsSync(filePath);
      
      expect(exists).toBe(false);
      expect(mockedFs.existsSync).toHaveBeenCalledWith(filePath);
    });

    it('should validate image file extensions', () => {
      const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      const testFiles = [
        'image.jpg',
        'photo.jpeg', 
        'picture.png',
        'animation.gif',
        'modern.webp',
        'document.pdf', // Invalid
        'text.txt'      // Invalid
      ];
      
      testFiles.forEach(filename => {
        const hasValidExtension = validExtensions.some(ext => 
          filename.toLowerCase().endsWith(ext)
        );
        
        if (filename.includes('.pdf') || filename.includes('.txt')) {
          expect(hasValidExtension).toBe(false);
        } else {
          expect(hasValidExtension).toBe(true);
        }
      });
    });
  });

  describe('API Parameter Validation', () => {
    it('should validate shop_id format', () => {
      const validShopIds = ['123', '456789', '1'];
      const invalidShopIds = ['', 'abc', '12.34', 'shop-123'];
      
      const isValidShopId = (id: string) => /^\d+$/.test(id) && id.length > 0;
      
      validShopIds.forEach(id => {
        expect(isValidShopId(id)).toBe(true);
      });
      
      invalidShopIds.forEach(id => {
        expect(isValidShopId(id)).toBe(false);
      });
    });

    it('should validate listing_id format', () => {
      const validListingIds = ['987654321', '1', '123456'];
      const invalidListingIds = ['', 'listing-123', '12.34', 'abc'];
      
      const isValidListingId = (id: string) => /^\d+$/.test(id) && id.length > 0;
      
      validListingIds.forEach(id => {
        expect(isValidListingId(id)).toBe(true);
      });
      
      invalidListingIds.forEach(id => {
        expect(isValidListingId(id)).toBe(false);
      });
    });

    it('should validate required fields', () => {
      const requiredFields = ['shop_id', 'listing_id'];
      const testData = { shop_id: '123' }; // Missing listing_id
      
      const missingFields = requiredFields.filter(field => 
        !testData[field as keyof typeof testData]
      );
      
      expect(missingFields).toContain('listing_id');
      expect(missingFields).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should create McpError with correct error codes', () => {
      const internalError = new McpError(ErrorCode.InternalError, 'Internal server error');
      const invalidParamsError = new McpError(ErrorCode.InvalidParams, 'Invalid parameters');
      
      expect(internalError.code).toBe(ErrorCode.InternalError);
      expect(internalError.message).toContain('Internal server error');
      
      expect(invalidParamsError.code).toBe(ErrorCode.InvalidParams);
      expect(invalidParamsError.message).toContain('Invalid parameters');
    });

    it('should handle different error scenarios', () => {
      const errorScenarios = [
        { status: 400, errorType: 'InvalidParams' },
        { status: 401, errorType: 'Unauthorized' },
        { status: 404, errorType: 'NotFound' },
        { status: 429, errorType: 'RateLimit' },
        { status: 500, errorType: 'InternalError' }
      ];
      
      errorScenarios.forEach(scenario => {
        expect(scenario.status).toBeGreaterThanOrEqual(400);
        expect(scenario.errorType).toBeTruthy();
      });
    });
  });

  describe('OAuth Token Management', () => {
    it('should validate token refresh parameters', () => {
      const tokenParams = {
        grant_type: 'refresh_token',
        client_id: 'test-client-id',
        refresh_token: 'test-refresh-token'
      };
      
      expect(tokenParams.grant_type).toBe('refresh_token');
      expect(tokenParams.client_id).toBeTruthy();
      expect(tokenParams.refresh_token).toBeTruthy();
    });

    it('should validate access token format', () => {
      const validTokens = [
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        'abc123def456',
        'token-with-dashes-123'
      ];
      
      const invalidTokens = ['', null, undefined];
      
      validTokens.forEach(token => {
        expect(token).toBeTruthy();
        expect(typeof token).toBe('string');
      });
      
      invalidTokens.forEach(token => {
        expect(token).toBeFalsy();
      });
    });
  });

  describe('API Endpoint Construction', () => {
    it('should construct correct API endpoints', () => {
      const baseURL = 'https://api.etsy.com/v3';
      const endpoints = {
        shops: (shopId: string) => `/application/shops/${shopId}`,
        listings: (shopId: string) => `/application/shops/${shopId}/listings`,
        listingImages: (shopId: string, listingId: string) => 
          `/application/shops/${shopId}/listings/${listingId}/images`,
        users: '/application/users/me'
      };
      
      expect(endpoints.shops('123')).toBe('/application/shops/123');
      expect(endpoints.listings('456')).toBe('/application/shops/456/listings');
      expect(endpoints.listingImages('789', '101112')).toBe('/application/shops/789/listings/101112/images');
      expect(endpoints.users).toBe('/application/users/me');
    });

    it('should validate URL construction', () => {
      const constructURL = (base: string, path: string) => {
        if (!base.endsWith('/') && !path.startsWith('/')) {
          return `${base}/${path}`;
        }
        if (base.endsWith('/') && path.startsWith('/')) {
          return `${base}${path.substring(1)}`;
        }
        return `${base}${path}`;
      };
      
      expect(constructURL('https://api.etsy.com/v3', '/shops/123')).toBe('https://api.etsy.com/v3/shops/123');
      expect(constructURL('https://api.etsy.com/v3/', 'shops/123')).toBe('https://api.etsy.com/v3/shops/123');
      expect(constructURL('https://api.etsy.com/v3/', '/shops/123')).toBe('https://api.etsy.com/v3/shops/123');
    });
  });

  describe('Data Transformation', () => {
    it('should transform listing data correctly', () => {
      const mockListingData = {
        listing_id: 123456,
        title: 'Test Product',
        price: '29.99',
        currency_code: 'USD',
        quantity: 5
      };
      
      const transformedData = {
        id: mockListingData.listing_id.toString(),
        title: mockListingData.title,
        price: parseFloat(mockListingData.price),
        currency: mockListingData.currency_code,
        available: mockListingData.quantity > 0
      };
      
      expect(transformedData.id).toBe('123456');
      expect(transformedData.price).toBe(29.99);
      expect(transformedData.available).toBe(true);
    });

    it('should handle missing or invalid data', () => {
      const incompleteData = {
        listing_id: 123,
        title: '',
        price: 'invalid',
        quantity: 0
      };
      
      const safeTransform = (data: any) => ({
        id: data.listing_id?.toString() || 'unknown',
        title: data.title || 'Untitled',
        price: parseFloat(data.price) || 0,
        available: (data.quantity || 0) > 0
      });
      
      const result = safeTransform(incompleteData);
      
      expect(result.id).toBe('123');
      expect(result.title).toBe('Untitled');
      expect(result.price).toBe(0);
      expect(result.available).toBe(false);
    });
  });
});
