import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';
import http from 'http';
import url from 'url';

const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

export async function getAuthClient() {
  try {
    let credentials;
    if (process.env.GOOGLE_CREDENTIALS_JSON) {
      credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    } else {
      const content = await fs.readFile(CREDENTIALS_PATH, 'utf-8');
      credentials = JSON.parse(content);
    }
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
    
    // Default to a localhost redirect URI if available, or port 3000
    const redirectUri = redirect_uris && redirect_uris.length > 0 
      ? (redirect_uris.find((u: string) => u.includes('localhost')) || redirect_uris[0]) 
      : 'http://localhost:3000/oauth2callback';
    
    const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirectUri
    );

    try {
      let tokenPayload;
      if (process.env.GOOGLE_TOKEN_JSON) {
        tokenPayload = JSON.parse(process.env.GOOGLE_TOKEN_JSON);
      } else {
        const token = await fs.readFile(TOKEN_PATH, 'utf-8');
        tokenPayload = JSON.parse(token);
      }
      oAuth2Client.setCredentials(tokenPayload);
      return oAuth2Client;
    } catch (err) {
      return await getNewToken(oAuth2Client);
    }
  } catch (error) {
    console.error('Error loading client secret file:', error);
    throw new Error('Could not load credentials.json. Please ensure it exists in the project root and is properly formatted.');
  }
}

async function getNewToken(oAuth2Client: any): Promise<any> {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/documents'
    ],
  });

  console.error('====================================================');
  console.error('AUTHORIZATION REQUIRED');
  console.error('Please authorize this app by visiting this URL:');
  console.error(authUrl);
  console.error('====================================================');

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (req.url) {
          const qs = new url.URL(req.url, 'http://localhost:3000').searchParams;
          const code = qs.get('code');
          if (code) {
            res.end('Authentication successful! You can close this window.');
            server.close();
            
            const { tokens } = await oAuth2Client.getToken(code);
            oAuth2Client.setCredentials(tokens);
            await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens));
            console.error('Token stored to', TOKEN_PATH);
            resolve(oAuth2Client);
          } else if (req.url !== '/favicon.ico') {
            res.end('No code found in URL.');
          }
        }
      } catch (e) {
        reject(e);
      }
    }).listen(3000, () => {
      console.error('Listening on http://localhost:3000 for OAuth callback.');
    });
  });
}
