# Implementation Guide: Google Workspace Integration MCP Server

This document outlines the step-by-step implementation plan for building the Google Workspace MCP Server, based on the architecture and problem statement. We will use **TypeScript/Node.js** for this implementation.

## 1. Prerequisites
*   **Node.js**: v18 or higher recommended.
*   **Google Cloud Account**: Access to Google Cloud Console to create a project and manage APIs.
*   **MCP Client**: Claude Desktop, Cursor, or the official MCP Inspector for testing.

## 2. Project Initialization & Dependencies

### 2.1. Initialize the Project
Create a new directory and initialize a Node.js project:
```bash
mkdir google-workspace-mcp
cd google-workspace-mcp
npm init -y
tsc --init
```

### 2.2. Install Dependencies
Install the required packages for the MCP SDK and Google APIs:
```bash
# Core Dependencies
npm install @modelcontextprotocol/sdk googleapis

# TypeScript & Development Dependencies
npm install -D typescript @types/node ts-node
```

Update your `tsconfig.json` to ensure `"moduleResolution": "node"` and `"target": "ES2022"`.

## 3. Google Cloud Console Setup

Before writing code, configure Google Cloud:
1.  **Create a New Project**: Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project.
2.  **Enable APIs**: 
    *   Navigate to "APIs & Services" > "Library".
    *   Search for and enable the **Gmail API**.
    *   Search for and enable the **Google Docs API**.
3.  **Configure OAuth Consent Screen**:
    *   Set user type to "External" (or "Internal" if you are within a Google Workspace org).
    *   Add the following scopes:
        *   `https://www.googleapis.com/auth/gmail.send`
        *   `https://www.googleapis.com/auth/documents`
    *   Add your own email address as a Test User.
4.  **Create Credentials**:
    *   Go to "Credentials" > "Create Credentials" > "OAuth client ID".
    *   Application type: "Desktop app".
    *   Download the generated JSON file and save it as `credentials.json` in your project root.
    *   **IMPORTANT**: Add `credentials.json` and `token.json` to your `.gitignore` file.

## 4. Implementation Steps

### Step 1: Authentication Manager (`src/auth.ts`)
Create a module to handle the OAuth 2.0 flow. 
*   Load client secrets from `credentials.json`.
*   Check for an existing `token.json`.
*   If `token.json` is missing or expired, generate an auth URL, ask the user to authorize via the browser, and exchange the resulting code for tokens.
*   Return a configured `google.auth.OAuth2` client.

### Step 2: Gmail Service (`src/gmail.ts`)
Implement the `send_gmail` functionality.
*   Accept `to`, `cc`, `bcc`, `subject`, and `body` as parameters.
*   Construct an RFC 2822 compliant email string (including headers like `To:`, `Subject:`, `Content-Type: text/html`).
*   Encode the string to `base64url`.
*   Call `gmail.users.messages.send({ userId: 'me', requestBody: { raw: encodedMessage } })`.

### Step 3: Google Docs Service (`src/docs.ts`)
Implement the `append_to_google_doc` functionality.
*   Accept `documentId` and `text` as parameters.
*   Call `docs.documents.batchUpdate` with the `insertText` request.
*   Use `endOfSegmentLocation: { segmentId: "" }` to append to the very end of the document body.

### Step 4: MCP Server Core (`src/index.ts`)
Set up the MCP Server and routing logic.
*   Import `Server` and `StdioServerTransport` from `@modelcontextprotocol/sdk`.
*   Define the server initialization and capabilities.
*   Use `server.setRequestHandler(ListToolsRequestSchema, ...)` to expose `send_gmail` and `append_to_google_doc` with their expected JSON schemas.
*   Use `server.setRequestHandler(CallToolRequestSchema, ...)` to intercept tool calls.
    *   Switch on `request.params.name`.
    *   Extract arguments and call the respective functions from `src/gmail.ts` or `src/docs.ts`.
    *   Return success responses or gracefully format errors (`return { isError: true, content: [...] }`).
*   Connect the server using `StdioServerTransport`.

## 5. Testing the Implementation

### 5.1. Local Testing with MCP Inspector
Use the official MCP inspector to test your server without needing a full desktop client:
```bash
npx @modelcontextprotocol/inspector ts-node src/index.ts
```
This will open a web interface where you can view your advertised tools and test executing them. The first run will likely print a URL to your console (stdout/stderr) asking you to authenticate with Google.

### 5.2. Integration with Claude Desktop
To use this with Claude Desktop, update the Claude Desktop configuration file (usually located at `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "node",
      "args": [
        "C:\\absolute\\path\\to\\your\\project\\build\\index.js"
      ]
    }
  }
}
```
*Note: Make sure to compile your TypeScript code (`npx tsc`) before pointing Claude Desktop to the built JavaScript file.*

## 6. Success Validation Checklist
- [ ] OAuth flow works, and `token.json` is successfully generated and refreshed.
- [ ] `tools/list` successfully returns both tools with accurate schemas.
- [ ] Using `send_gmail` delivers an email to the specified recipient.
- [ ] Using `append_to_google_doc` adds text to the bottom of the target document without deleting existing text.
- [ ] Invalid inputs (e.g., bad document ID) return clean error messages to the LLM rather than crashing the process.
