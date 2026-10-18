#!/usr/bin/env node
import "dotenv/config";
import express from "express";
import { randomUUID } from "crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  isInitializeRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { tools } from "./tools/index.js";

const PORT = process.env.PORT || 9898;
const API_KEY = process.env.MCP_API_KEY;

if (!API_KEY) {
  console.error("[!] ERROR: MCP_API_KEY not defined in .env file. Server cannot start.");
  process.exit(1);
}

// ==========================================
// 1. MCP SERVER + TOOL ROUTER
// ==========================================
function getServer() {
  const server = new Server(
    { name: "life-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => t.definition),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    const tool = tools.find((t) => t.definition.name === name);

    if (!tool) {
      return {
        isError: true,
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
      };
    }

    try {
      return await tool.handler(args);
    } catch (error) {
      console.error(`[tool:${name}]`, error);
      return {
        isError: true,
        content: [{ type: "text", text: `Hata (${name}): ${error.message}` }],
      };
    }
  });

  return server;
}

// ==========================================
// 2. EXPRESS + AUTH
// ==========================================
const app = express();
app.use(express.json());

function checkAuth(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${API_KEY}`) {
    console.warn(`[!] Unauthorized access attempt: ${req.ip}`);
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

// ==========================================
// 3. STREAMABLE HTTP TRANSPORT (session-based)
// ==========================================
const transports = {};

app.post("/mcp", async (req, res) => {
  if (!checkAuth(req, res)) return;

  const sessionId = req.headers["mcp-session-id"];
  let transport;

  if (sessionId && transports[sessionId]) {
    transport = transports[sessionId];
  } else if (!sessionId && isInitializeRequest(req.body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        transports[sid] = transport;
        console.log(`[+] Yeni oturum: ${sid}`);
      },
    });

    transport.onclose = () => {
      if (transport.sessionId) {
        delete transports[transport.sessionId];
        console.log(`[-] Session closed: ${transport.sessionId}`);
      }
    };

    const server = getServer();
    await server.connect(transport);
  } else {
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Invalid session or missing initialize request." },
      id: null,
    });
    return;
  }

  await transport.handleRequest(req, res, req.body);
});

app.get("/mcp", async (req, res) => {
  if (!checkAuth(req, res)) return;
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await transports[sessionId].handleRequest(req, res);
});

app.delete("/mcp", async (req, res) => {
  if (!checkAuth(req, res)) return;
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await transports[sessionId].handleRequest(req, res);
  delete transports[sessionId];
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[+] Life MCP Server running on port ${PORT}.`);
  console.log(`[+] Endpoint: http://0.0.0.0:${PORT}/mcp`);
  console.log(`[+] Active tools: ${tools.map((t) => t.definition.name).join(", ")}`);
});
