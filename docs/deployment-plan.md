# Deployment Plan: Google Workspace MCP Server on Railway

Deploying an MCP server to a cloud provider like Railway requires some structural changes. Currently, your server communicates over standard input/output (`stdio`), which is designed for local, machine-to-machine execution. To host it on the internet, it needs to communicate over HTTP.

Here is the step-by-step plan to prepare and deploy your server:

## 1. Convert Transport to SSE (Server-Sent Events)
Railway expects a web server that binds to a specific `$PORT`. We need to switch the MCP transport from `stdio` to HTTP/SSE.
- **Action:** Install `express` (and `@types/express`).
- **Action:** Modify `src/index.ts` to initialize an Express web server.
- **Action:** Replace `StdioServerTransport` with `SSEServerTransport`.
- **Action:** Expose an `/sse` endpoint for clients to connect, and a `/message` endpoint for incoming JSON-RPC calls.

## 2. Secure Credentials via Environment Variables
Currently, your app reads `credentials.json` and `token.json` from the local disk. When deploying to Railway (or any cloud provider), it's highly discouraged to commit these files to Git for security reasons.
- **Action:** Update `src/auth.ts` to check for environment variables (e.g., `process.env.GOOGLE_CREDENTIALS` and `process.env.GOOGLE_TOKEN`).
- **Action:** If the environment variables exist, parse them directly. If not, fall back to reading the local `.json` files.
- **Action:** Before deploying, you will stringify your local JSON files and add them as Variables in the Railway Dashboard.

## 3. Update `package.json` Scripts
Railway automatically detects Node.js projects and handles the build/run process if the standard scripts are defined.
- **Action:** Add `"build": "tsc"` to your `scripts`.
- **Action:** Add `"start": "node build/index.js"` to your `scripts`.

## 4. Deployment Steps (Railway)
1. Push your updated code to a GitHub repository (making sure `credentials.json` and `token.json` are in `.gitignore`).
2. Log into Railway and create a new project from your GitHub repository.
3. Go to the **Variables** tab in Railway and add your environment variables.
4. Railway will automatically build and deploy your app. You'll receive a public URL (e.g., `https://your-app.up.railway.app/sse`) that you can plug into any remote MCP client!
