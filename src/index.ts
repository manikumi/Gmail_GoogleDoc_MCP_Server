#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { getAuthClient } from "./auth";
import { sendEmail } from "./gmail";
import { appendToGoogleDoc } from "./docs";

async function main() {
  // Ensure we can authenticate before starting the MCP server
  const authClient = await getAuthClient();

  const server = new Server(
    {
      name: "google-workspace-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "send_gmail",
          description: "Sends an email from the authenticated user's Gmail account.",
          inputSchema: {
            type: "object",
            properties: {
              to: {
                type: "string",
                description: "Comma-separated list of recipient email addresses.",
              },
              cc: {
                type: "string",
                description: "Comma-separated list of CC addresses.",
              },
              bcc: {
                type: "string",
                description: "Comma-separated list of BCC addresses.",
              },
              subject: {
                type: "string",
                description: "The subject line of the email.",
              },
              body: {
                type: "string",
                description: "The main content of the email (supports plain text and basic HTML).",
              },
            },
            required: ["to", "subject", "body"],
          },
        },
        {
          name: "append_to_google_doc",
          description: "Appends text to the end of a specified Google Document.",
          inputSchema: {
            type: "object",
            properties: {
              documentId: {
                type: "string",
                description: "The unique ID of the Google Doc (extracted from the Doc URL).",
              },
              text: {
                type: "string",
                description: "The content to append to the document.",
              },
            },
            required: ["documentId", "text"],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      if (request.params.name === "send_gmail") {
        const result = await sendEmail(authClient, request.params.arguments as any);
        return {
          content: [
            {
              type: "text",
              text: `Email sent successfully. Message ID: ${result.messageId}`,
            },
          ],
        };
      } else if (request.params.name === "append_to_google_doc") {
        const result = await appendToGoogleDoc(authClient, request.params.arguments as any);
        return {
          content: [
            {
              type: "text",
              text: `Text appended successfully to document ${result.documentId}.`,
            },
          ],
        };
      }

      throw new Error(`Unknown tool: ${request.params.name}`);
    } catch (error: any) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: error.message,
          },
        ],
      };
    }
  });

  const app = express();
  
  let transport: SSEServerTransport;

  app.get("/sse", async (req, res) => {
    transport = new SSEServerTransport("/message", res);
    await server.connect(transport);
  });

  app.post("/message", async (req, res) => {
    if (transport) {
      await transport.handlePostMessage(req, res);
    } else {
      res.status(400).send("SSE transport not connected");
    }
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Google Workspace MCP Server running on SSE at http://localhost:${PORT}/sse`);
  });
}

main().catch((error) => {
  console.error("Fatal error running MCP Server:", error);
  process.exit(1);
});
