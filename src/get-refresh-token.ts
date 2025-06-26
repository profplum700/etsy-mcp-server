import axios from 'axios';
import * as crypto from 'crypto';
import express, { Request, Response } from 'express';
import open from 'open';
import path from 'path';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';

// -----------------------------------------------------------------------------
// Parse optional command-line arguments so the script can run non-interactively.
// Usage: node get-refresh-token.js --keystring=<API_KEYSTRING> --shared-secret=<SHARED_SECRET>
// -----------------------------------------------------------------------------
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

const app = express();
const port: number = argPort || 3030;

const readline = createInterface({
  input: process.stdin,
  output: process.stdout
});

interface EtsyCreds {
  keystring: string;
  sharedSecret: string;
}

const getEtsyCreds = (): Promise<EtsyCreds> => {
  // If both credentials were supplied via CLI parameters, skip the interactive
  // prompts entirely. If one is missing, prompt only for the missing piece.
  if (argKeystring && argSharedSecret) {
    return Promise.resolve({ keystring: argKeystring, sharedSecret: argSharedSecret });
  }

  return new Promise((resolve) => {
    const askSharedSecret = (keystring: string) => {
      if (argSharedSecret) {
        return resolve({ keystring, sharedSecret: argSharedSecret });
      }
      readline.question('Enter your Etsy Shared Secret: ', (sharedSecret) => {
        resolve({ keystring, sharedSecret });
      });
    };

    if (argKeystring) {
      askSharedSecret(argKeystring);
    } else {
      readline.question('Enter your Etsy Keystring: ', (keystring) => {
        askSharedSecret(keystring);
      });
    }
  });
};

app.get('/oauth/redirect', async (req: Request, res: Response) => {
  console.log('Redirect received with query:', req.query);
  const { code } = req.query as { code?: string };
  const { keystring } = app.locals as { keystring: string };

  if (!code) {
    res.status(400).send('Authorization code is missing.');
    return;
  }

  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', keystring);
    params.append('redirect_uri', `http://localhost:${port}/oauth/redirect`);
    params.append('code', code as string);
    params.append('code_verifier', (app.locals as { codeVerifier: string }).codeVerifier);

    const tokenResponse = await axios.post('https://api.etsy.com/v3/public/oauth/token', params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-api-key': keystring
      }
    });

    const { access_token, refresh_token } = tokenResponse.data as {
      access_token: string;
      refresh_token: string;
    };

    console.log('Access Token:', access_token);
    console.log('Refresh Token:', refresh_token);
    res.send('Authentication successful! You can close this window.');
    readline.close();
    process.exit(0);
  } catch (error: any) {
    console.error('Error exchanging authorization code for access token:', error.response ? error.response.data : error.message);
    res.status(500).send('Failed to get access token.');
    readline.close();
    process.exit(1);
  }
});

const main = async () => {
  const { keystring, sharedSecret } = await getEtsyCreds();
  (app.locals as any).keystring = keystring;
  (app.locals as any).sharedSecret = sharedSecret;

  // Generate a PKCE code verifier (43-128 chars) and its SHA256-based code challenge.
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  (app.locals as any).codeVerifier = codeVerifier;

  const scopes = ['listings_r', 'listings_w', 'shops_r', 'shops_w', 'transactions_r', 'transactions_w'].join(' ');

  // Etsy requires a unique `state` param in the authorization request.
  const state = Math.random().toString(36).substring(2, 15);
  (app.locals as any).state = state;

  const authUrl = `https://www.etsy.com/oauth/connect?response_type=code&client_id=${keystring}&redirect_uri=http://localhost:${port}/oauth/redirect&scope=${scopes}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

  console.log('Opening browser for authentication...');
  await open(authUrl);

  app.listen(port, () => {
    console.log(`Server is listening on http://localhost:${port}`);
    console.log('If you changed the port, ensure this exact callback URL is registered in your Etsy app settings.');
  });
};

// Exported for unit testing
export { app, getEtsyCreds, main };

// Only run automatically when executed directly, not when imported (e.g. by tests)
const isMain =
  path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url);

if (isMain) {
  void main();
}
