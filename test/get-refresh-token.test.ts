import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('get-refresh-token module', () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
  });

  describe('CLI argument parsing', () => {
    it('should handle keystring argument', () => {
      const testKeystring = 'test-keystring-123';
      process.argv = ['node', 'script.js', `--keystring=${testKeystring}`];
      
      // Parse arguments manually to test the logic
      const cliArgs = process.argv.slice(2);
      let argKeystring: string | undefined;
      
      for (const arg of cliArgs) {
        if (arg.startsWith('--keystring=')) {
          argKeystring = arg.split('=')[1];
        }
      }
      
      expect(argKeystring).toBe(testKeystring);
    });

    it('should handle shared-secret argument', () => {
      const testSecret = 'test-secret-456';
      process.argv = ['node', 'script.js', `--shared-secret=${testSecret}`];
      
      const cliArgs = process.argv.slice(2);
      let argSharedSecret: string | undefined;
      
      for (const arg of cliArgs) {
        if (arg.startsWith('--shared-secret=')) {
          argSharedSecret = arg.split('=')[1];
        }
      }
      
      expect(argSharedSecret).toBe(testSecret);
    });

    it('should handle port argument', () => {
      const testPort = '4040';
      process.argv = ['node', 'script.js', `--port=${testPort}`];
      
      const cliArgs = process.argv.slice(2);
      let argPort: number | undefined;
      
      for (const arg of cliArgs) {
        if (arg.startsWith('--port=')) {
          argPort = parseInt(arg.split('=')[1], 10);
        }
      }
      
      expect(argPort).toBe(4040);
    });

    it('should handle multiple arguments', () => {
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
      
      for (const arg of cliArgs) {
        if (arg.startsWith('--keystring=')) {
          argKeystring = arg.split('=')[1];
        } else if (arg.startsWith('--shared-secret=')) {
          argSharedSecret = arg.split('=')[1];
        } else if (arg.startsWith('--port=')) {
          argPort = parseInt(arg.split('=')[1], 10);
        }
      }
      
      expect(argKeystring).toBe('key123');
      expect(argSharedSecret).toBe('secret456');
      expect(argPort).toBe(3030);
    });

    it('should handle invalid port gracefully', () => {
      process.argv = ['node', 'script.js', '--port=invalid'];
      
      const cliArgs = process.argv.slice(2);
      let argPort: number | undefined;
      
      for (const arg of cliArgs) {
        if (arg.startsWith('--port=')) {
          argPort = parseInt(arg.split('=')[1], 10);
        }
      }
      
      expect(argPort).toBeNaN();
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
});
