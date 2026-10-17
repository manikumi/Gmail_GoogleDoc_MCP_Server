# Google Workspace MCP Server

This is a Model Context Protocol (MCP) server that provides tools to interact with Google Workspace APIs (Gmail and Google Docs). It is designed to be easily deployed to cloud services like Railway using Server-Sent Events (SSE).

## Features

- **Send Gmail**: Compose and send emails directly from the authenticated user's Gmail account (supports CC, BCC, and HTML).
- **Append to Google Docs**: Append text to the end of any Google Document you have access to.

## Architecture

This MCP server uses the `@modelcontextprotocol/sdk` to define and handle tools.
It is built with TypeScript, runs on Node.js, and exposes its MCP capabilities over HTTP using `SSEServerTransport` and `express`.

## Local Development

### Prerequisites

1. Create an OAuth 2.0 Client ID for a Desktop application in the [Google Cloud Console](https://console.cloud.google.com/).
2. Download the client credentials and save them as `credentials.json` in the root directory.

### Setup

```bash
# Install dependencies
npm install

# Build the TypeScript project
npm run build

# Start the server
npm start
```

To create `token.json`, run `npm run auth`, open the printed URL and sign in. It saves only a refresh token (no expiry date); access tokens are refreshed automatically.

> **Token expiry:** if the OAuth consent screen in Google Cloud is in **Testing** mode, Google expires refresh tokens after 7 days. Set it to **In production** (Google Auth Platform → Audience → Publish app) *before* running `npm run auth` so the token does not expire.

## Deployment (Railway)

This server is pre-configured to be deployed on services like Railway.

1. Do NOT commit `credentials.json` or `token.json` to version control. They are securely ignored via `.gitignore`.
2. Push your code to GitHub.
3. Connect your repository to Railway.
4. Set the following Environment Variables in the Railway Dashboard:
   - `GOOGLE_CREDENTIALS_JSON`: The stringified contents of your local `credentials.json`.
   - `GOOGLE_TOKEN_JSON`: The stringified contents of your local `token.json`.

Railway will automatically build the project and start the SSE transport on the assigned `$PORT`. You can then connect to your cloud-hosted MCP server via the `/sse` endpoint.

## License

ISC
