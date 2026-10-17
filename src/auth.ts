import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';
import http from 'http';
import url from 'url';

const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

// Port used only for the one-time local OAuth sign-in.
const OAUTH_PORT = 3000;

export const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/documents',
];

async function loadCredentials() {
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    return JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  }
  const content = await fs.readFile(CREDENTIALS_PATH, 'utf-8');
  return JSON.parse(content);
}

async function loadToken() {
  if (process.env.GOOGLE_TOKEN_JSON) {
    return JSON.parse(process.env.GOOGLE_TOKEN_JSON);
  }
  const token = await fs.readFile(TOKEN_PATH, 'utf-8');
  return JSON.parse(token);
}

// Only the refresh token is stored. It has no expiry date (as long as the
// OAuth app is "In production"); short-lived access tokens are fetched
// from it automatically whenever needed.
function toStoredToken(tokens: any) {
  return {
    refresh_token: tokens.refresh_token,
    scope: tokens.scope,
    token_type: tokens.token_type || 'Bearer',
  };
}

export async function createOAuthClient() {
  const credentials = await loadCredentials();
  const { client_secret, client_id } = credentials.installed || credentials.web;
  // Desktop OAuth clients accept any localhost port, so use the port we listen on.
  return new google.auth.OAuth2(client_id, client_secret, `http://localhost:${OAUTH_PORT}`);
}

export async function getAuthClient() {
  let oAuth2Client;
  try {
    oAuth2Client = await createOAuthClient();
  } catch (error) {
    console.error('Error loading client secret file:', error);
    throw new Error('Could not load credentials. Set GOOGLE_CREDENTIALS_JSON or put credentials.json in the project root.');
  }

  let tokenPayload;
  try {
    tokenPayload = await loadToken();
  } catch {
    if (process.env.GOOGLE_CREDENTIALS_JSON) {
      // Running in the cloud: there is no browser to sign in with.
      throw new Error('GOOGLE_TOKEN_JSON is missing. Run "npm run auth" locally and copy token.json into it.');
    }
    return await getNewToken(oAuth2Client);
  }

  if (!tokenPayload.refresh_token) {
    throw new Error('Token has no refresh_token. Run "npm run auth" again to create a new one.');
  }

  // Use only the refresh token; ignore any stored access token / expiry.
  oAuth2Client.setCredentials({ refresh_token: tokenPayload.refresh_token });

  // Fail fast on startup if the token was revoked or belongs to other credentials.
  try {
    await oAuth2Client.getAccessToken();
  } catch (e: any) {
    const detail = e?.response?.data?.error_description || e.message;
    throw new Error(`Google token is invalid (${detail}). Run "npm run auth" to create a new token.`);
  }

  return oAuth2Client;
}

export async function getNewToken(oAuth2Client: any): Promise<any> {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // always return a refresh token
    scope: SCOPES,
  });

  console.error('====================================================');
  console.error('AUTHORIZATION REQUIRED');
  console.error('Please authorize this app by visiting this URL:');
  console.error(authUrl);
  console.error('====================================================');

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (!req.url || req.url === '/favicon.ico') {
          res.end();
          return;
        }
        const qs = new url.URL(req.url, `http://localhost:${OAUTH_PORT}`).searchParams;
        const code = qs.get('code');
        if (!code) {
          res.end(`No code found in URL. ${qs.get('error') || ''}`);
          return;
        }
        res.end('Authentication successful! You can close this window.');
        server.close();

        const { tokens } = await oAuth2Client.getToken(code);
        if (!tokens.refresh_token) {
          throw new Error('Google did not return a refresh token. Remove the app at https://myaccount.google.com/permissions and try again.');
        }
        oAuth2Client.setCredentials({ refresh_token: tokens.refresh_token });
        await fs.writeFile(TOKEN_PATH, JSON.stringify(toStoredToken(tokens)));
        console.error('Token stored to', TOKEN_PATH);
        if (tokens.refresh_token_expires_in) {
          console.error(
            `WARNING: this refresh token expires in ${Math.round(tokens.refresh_token_expires_in / 86400)} days. ` +
            'Your OAuth consent screen is in "Testing" mode. Publish it ("In production") and run "npm run auth" again for a token that does not expire.'
          );
        }
        resolve(oAuth2Client);
      } catch (e) {
        reject(e);
      }
    }).listen(OAUTH_PORT, () => {
      console.error(`Listening on http://localhost:${OAUTH_PORT} for OAuth callback.`);
    });
  });
}
