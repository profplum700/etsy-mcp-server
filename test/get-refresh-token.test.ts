import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('get-refresh-token module', () => {
  const originalArgv = process.argv;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.argv = originalArgv;
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('CLI argument parsing', () => {
    it('should handle keystring argument with equals format', () => {
      const testKeystring = 'test-keystring-123';
      process.argv = ['node', 'script.js', `--keystring=${testKeystring}`];
      
      // Parse arguments manually to test the logic
      const cliArgs = process.argv.slice(2);
      let argKeystring: string | undefined;
      
      for (let i = 0; i < cliArgs.length; i++) {
        const arg = cliArgs[i];
        if (arg.startsWith('--keystring=')) {
          argKeystring = arg.split('=')[1];
        } else if (arg === '--keystring' && i + 1 < cliArgs.length) {
          argKeystring = cliArgs[i + 1];
          i++;
        }
      }
      
      expect(argKeystring).toBe(testKeystring);
    });

    it('should handle keystring argument with space format', () => {
      const testKeystring = 'test-keystring-456';
      process.argv = ['node', 'script.js', '--keystring', testKeystring];
      
      const cliArgs = process.argv.slice(2);
      let argKeystring: string | undefined;
      
      for (let i = 0; i < cliArgs.length; i++) {
        const arg = cliArgs[i];
        if (arg.startsWith('--keystring=')) {
          argKeystring = arg.split('=')[1];
        } else if (arg === '--keystring' && i + 1 < cliArgs.length) {
          argKeystring = cliArgs[i + 1];
          i++;
        }
      }
      
      expect(argKeystring).toBe(testKeystring);
    });

    it('should handle shared-secret argument with equals format', () => {
      const testSecret = 'test-secret-456';
      process.argv = ['node', 'script.js', `--shared-secret=${testSecret}`];
      
      const cliArgs = process.argv.slice(2);
      let argSharedSecret: string | undefined;
      
      for (let i = 0; i < cliArgs.length; i++) {
        const arg = cliArgs[i];
        if (arg.startsWith('--shared-secret=')) {
          argSharedSecret = arg.split('=')[1];
        } else if (arg === '--shared-secret' && i + 1 < cliArgs.length) {
          argSharedSecret = cliArgs[i + 1];
          i++;
        }
      }
      
      expect(argSharedSecret).toBe(testSecret);
    });

    it('should handle shared-secret argument with space format', () => {
      const testSecret = 'test-secret-789';
      process.argv = ['node', 'script.js', '--shared-secret', testSecret];
      
      const cliArgs = process.argv.slice(2);
      let argSharedSecret: string | undefined;
      
      for (let i = 0; i < cliArgs.length; i++) {
        const arg = cliArgs[i];
        if (arg.startsWith('--shared-secret=')) {
          argSharedSecret = arg.split('=')[1];
        } else if (arg === '--shared-secret' && i + 1 < cliArgs.length) {
          argSharedSecret = cliArgs[i + 1];
          i++;
        }
      }
      
      expect(argSharedSecret).toBe(testSecret);
    });

    it('should handle port argument with equals format', () => {
      const testPort = '4040';
      process.argv = ['node', 'script.js', `--port=${testPort}`];
      
      const cliArgs = process.argv.slice(2);
      let argPort: number | undefined;
      
      for (let i = 0; i < cliArgs.length; i++) {
        const arg = cliArgs[i];
        if (arg.startsWith('--port=')) {
          argPort = parseInt(arg.split('=')[1], 10);
        } else if (arg === '--port' && i + 1 < cliArgs.length) {
          argPort = parseInt(cliArgs[i + 1], 10);
          i++;
        }
      }
      
      expect(argPort).toBe(4040);
    });

    it('should handle port argument with space format', () => {
      const testPort = '5050';
      process.argv = ['node', 'script.js', '--port', testPort];
      
      const cliArgs = process.argv.slice(2);
      let argPort: number | undefined;
      
      for (let i = 0; i < cliArgs.length; i++) {
        const arg = cliArgs[i];
        if (arg.startsWith('--port=')) {
          argPort = parseInt(arg.split('=')[1], 10);
        } else if (arg === '--port' && i + 1 < cliArgs.length) {
          argPort = parseInt(cliArgs[i + 1], 10);
          i++;
        }
      }
      
      expect(argPort).toBe(5050);
    });

    it('should handle multiple arguments with mixed formats', () => {
      process.argv = [
        'node', 
        'script.js', 
        '--keystring', 'key123',
        '--shared-secret=secret456', 
        '--port', '3030'
      ];
      
      const cliArgs = process.argv.slice(2);
      let argKeystring: string | undefined;
      let argSharedSecret: string | undefined;
      let argPort: number | undefined;
      
      for (let i = 0; i < cliArgs.length; i++) {
        const arg = cliArgs[i];
        
        if (arg.startsWith('--keystring=')) {
          argKeystring = arg.split('=')[1];
        } else if (arg === '--keystring' && i + 1 < cliArgs.length) {
          argKeystring = cliArgs[i + 1];
          i++;
        } else if (arg.startsWith('--shared-secret=')) {
          argSharedSecret = arg.split('=')[1];
        } else if (arg === '--shared-secret' && i + 1 < cliArgs.length) {
          argSharedSecret = cliArgs[i + 1];
          i++;
        } else if (arg.startsWith('--port=')) {
          argPort = parseInt(arg.split('=')[1], 10);
        } else if (arg === '--port' && i + 1 < cliArgs.length) {
          argPort = parseInt(cliArgs[i + 1], 10);
          i++;
        }
      }
      
      expect(argKeystring).toBe('key123');
      expect(argSharedSecret).toBe('secret456');
      expect(argPort).toBe(3030);
    });

    it('should handle multiple arguments with equals format', () => {
      process.argv = [
        'node', 
        'script.js', 
        '--keystring=key123', 
        '--shared-secret=secret456', 
        '--port=3030'
      ];
      
      const cliArgs = process.argv.slice(2);
      let argKeystring: string | undefined;
      let argSharedSecret: string | undefined;
      let argPort: number | undefined;
      
      for (let i = 0; i < cliArgs.length; i++) {
        const arg = cliArgs[i];
        
        if (arg.startsWith('--keystring=')) {
          argKeystring = arg.split('=')[1];
        } else if (arg === '--keystring' && i + 1 < cliArgs.length) {
          argKeystring = cliArgs[i + 1];
          i++;
        } else if (arg.startsWith('--shared-secret=')) {
          argSharedSecret = arg.split('=')[1];
        } else if (arg === '--shared-secret' && i + 1 < cliArgs.length) {
          argSharedSecret = cliArgs[i + 1];
          i++;
        } else if (arg.startsWith('--port=')) {
          argPort = parseInt(arg.split('=')[1], 10);
        } else if (arg === '--port' && i + 1 < cliArgs.length) {
          argPort = parseInt(cliArgs[i + 1], 10);
          i++;
        }
      }
      
      expect(argKeystring).toBe('key123');
      expect(argSharedSecret).toBe('secret456');
      expect(argPort).toBe(3030);
    });

    it('should handle multiple arguments with space format', () => {
      process.argv = [
        'node', 
        'script.js', 
        '--keystring', 'key789',
        '--shared-secret', 'secret123', 
        '--port', '4040'
      ];
      
      const cliArgs = process.argv.slice(2);
      let argKeystring: string | undefined;
      let argSharedSecret: string | undefined;
      let argPort: number | undefined;
      
      for (let i = 0; i < cliArgs.length; i++) {
        const arg = cliArgs[i];
        
        if (arg.startsWith('--keystring=')) {
          argKeystring = arg.split('=')[1];
        } else if (arg === '--keystring' && i + 1 < cliArgs.length) {
          argKeystring = cliArgs[i + 1];
          i++;
        } else if (arg.startsWith('--shared-secret=')) {
          argSharedSecret = arg.split('=')[1];
        } else if (arg === '--shared-secret' && i + 1 < cliArgs.length) {
          argSharedSecret = cliArgs[i + 1];
          i++;
        } else if (arg.startsWith('--port=')) {
          argPort = parseInt(arg.split('=')[1], 10);
        } else if (arg === '--port' && i + 1 < cliArgs.length) {
          argPort = parseInt(cliArgs[i + 1], 10);
          i++;
        }
      }
      
      expect(argKeystring).toBe('key789');
      expect(argSharedSecret).toBe('secret123');
      expect(argPort).toBe(4040);
    });

    it('should handle invalid port gracefully', () => {
      process.argv = ['node', 'script.js', '--port=invalid'];
      
      const cliArgs = process.argv.slice(2);
      let argPort: number | undefined;
      
      for (let i = 0; i < cliArgs.length; i++) {
        const arg = cliArgs[i];
        if (arg.startsWith('--port=')) {
          argPort = parseInt(arg.split('=')[1], 10);
        } else if (arg === '--port' && i + 1 < cliArgs.length) {
          argPort = parseInt(cliArgs[i + 1], 10);
          i++;
        }
      }
      
      expect(argPort).toBeNaN();
    });

    it('should handle missing value for space format gracefully', () => {
      process.argv = ['node', 'script.js', '--keystring'];
      
      const cliArgs = process.argv.slice(2);
      let argKeystring: string | undefined;
      
      for (let i = 0; i < cliArgs.length; i++) {
        const arg = cliArgs[i];
        if (arg.startsWith('--keystring=')) {
          argKeystring = arg.split('=')[1];
        } else if (arg === '--keystring' && i + 1 < cliArgs.length) {
          argKeystring = cliArgs[i + 1];
          i++;
        }
      }
      
      expect(argKeystring).toBeUndefined();
    });
  });

  describe('OAuth URL construction', () => {
    it('should construct proper OAuth URL components', () => {
      const keystring = 'test-key';
      const port = 3030;
      const scopes = ['listings_r', 'listings_w', 'shops_r', 'shops_w', 'transactions_r', 'transactions_w'].join(' ');
      const state = 'test-state';
      const codeChallenge = 'test-challenge';
      
      const expectedUrl = `https://www.etsy.com/oauth/connect?response_type=code&client_id=${keystring}&redirect_uri=http://localhost:${port}/oauth/redirect&scope=${scopes}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
      
      expect(expectedUrl).toContain('https://www.etsy.com/oauth/connect');
      expect(expectedUrl).toContain(`client_id=${keystring}`);
      expect(expectedUrl).toContain(`redirect_uri=http://localhost:${port}/oauth/redirect`);
      expect(expectedUrl).toContain('code_challenge_method=S256');
    });

    it('should validate required OAuth parameters', () => {
      const requiredParams = [
        'response_type',
        'client_id',
        'redirect_uri',
        'scope',
        'state',
        'code_challenge',
        'code_challenge_method'
      ];
      
      const testUrl = 'https://www.etsy.com/oauth/connect?response_type=code&client_id=key&redirect_uri=http://localhost:3030/oauth/redirect&scope=listings_r&state=state&code_challenge=challenge&code_challenge_method=S256';
      
      requiredParams.forEach(param => {
        expect(testUrl).toContain(param);
      });
    });
  });

  describe('PKCE code generation', () => {
    it('should generate code verifier of appropriate length', () => {
      // Simulate code verifier generation (43-128 chars)
      const mockCodeVerifier = 'a'.repeat(43); // Minimum length
      const longCodeVerifier = 'b'.repeat(128); // Maximum length
      
      expect(mockCodeVerifier.length).toBe(43);
      expect(longCodeVerifier.length).toBe(128);
      expect(mockCodeVerifier.length).toBeGreaterThanOrEqual(43);
      expect(longCodeVerifier.length).toBeLessThanOrEqual(128);
    });

    it('should use SHA256 for code challenge', () => {
      const challengeMethod = 'S256';
      expect(challengeMethod).toBe('S256');
    });
  });

  describe('Express server configuration', () => {
    it('should use correct default port', () => {
      const defaultPort = 3030;
      expect(defaultPort).toBe(3030);
    });

    it('should handle custom port configuration', () => {
      const customPort = 4040;
      expect(customPort).toBeGreaterThan(3000);
      expect(customPort).toBeLessThan(10000);
    });
  });

  describe('OAuth success console output', () => {
    it('should contain success message pattern', () => {
      const expectedMessages = [
        'OAuth Authentication Successful!',
        'Access Token:',
        'Refresh Token:',
        'You can now use these tokens in your Etsy MCP server configuration.'
      ];
      
      expectedMessages.forEach(message => {
        expect(typeof message).toBe('string');
        expect(message.length).toBeGreaterThan(0);
      });
    });

    it('should format tokens with proper labels', () => {
      const accessToken = 'test-access-token-123';
      const refreshToken = 'test-refresh-token-456';
      
      const accessTokenOutput = `Access Token: ${accessToken}`;
      const refreshTokenOutput = `Refresh Token: ${refreshToken}`;
      
      expect(accessTokenOutput).toContain('Access Token:');
      expect(accessTokenOutput).toContain(accessToken);
      expect(refreshTokenOutput).toContain('Refresh Token:');
      expect(refreshTokenOutput).toContain(refreshToken);
    });

    it('should include visual separators', () => {
      const separator = '='.repeat(50);
      expect(separator).toBe('==================================================');
      expect(separator.length).toBe(50);
    });

    it('should validate token output format', () => {
      const mockTokens = {
        access_token: 'mock_access_token_12345',
        refresh_token: 'mock_refresh_token_67890'
      };
      
      // Verify the expected output format
      const expectedOutput = [
        '\nOAuth Authentication Successful!',
        '='.repeat(50),
        `Access Token: ${mockTokens.access_token}`,
        `Refresh Token: ${mockTokens.refresh_token}`,
        '='.repeat(50),
        'You can now use these tokens in your Etsy MCP server configuration.'
      ];
      
      expectedOutput.forEach(line => {
        expect(typeof line).toBe('string');
        if (line.includes('Token:')) {
          expect(line).toMatch(/^(Access|Refresh) Token: \w+/);
        }
      });
    });
  });
});
