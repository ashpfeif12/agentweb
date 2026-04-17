/**
 * TypeScript MCP Server Generator
 *
 * Takes a CapabilityMap and generates a complete, deployable
 * TypeScript MCP server using the @modelcontextprotocol/sdk.
 */

import type {
  CapabilityMap,
  GeneratorConfig,
  ToolDefinition,
  AuthConfig,
  TypeDefinition,
  ToolGenerator,
} from "../types.js";

export class TypeScriptGenerator implements ToolGenerator {
  generateTool(tool: ToolDefinition, config: GeneratorConfig): string {
    const params = tool.parameters
      .map((p) => {
        const zodType = this.toZodType(p.type, p.schema);
        const desc = p.description ? `.describe("${this.escapeString(p.description)}")` : "";
        return `    ${p.name}: z.${zodType}${p.required ? "" : ".optional()"}${desc}`;
      })
      .join(",\n");

    const inputSchema = params
      ? `z.object({\n${params}\n  })`
      : "z.object({})";

    return `
// Tool: ${tool.name}
// ${tool.description}
// Source: ${tool.source ? `${tool.source.method} ${tool.source.path}` : "custom"}
server.tool(
  "${tool.name}",
  "${this.escapeString(tool.description)}",
  ${inputSchema},
  {
    annotations: {
      readOnlyHint: ${tool.annotations.readOnlyHint},
      destructiveHint: ${tool.annotations.destructiveHint},
      idempotentHint: ${tool.annotations.idempotentHint},
      openWorldHint: ${tool.annotations.openWorldHint},
    },
  },
  async ({ ${tool.parameters.map((p) => p.name).join(", ")} }) => {
    ${this.generateToolBody(tool)}
  }
);`;
  }

  generateServer(map: CapabilityMap, config: GeneratorConfig): string {
    const imports = `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { createServer } from "http";
import { apiClient } from "./auth.js";
`;

    const serverInit = `
const server = new McpServer({
  name: "${this.escapeString(map.service.name)}",
  version: "${map.service.version || "1.0.0"}",
});

const BASE_URL = process.env.API_BASE_URL || "${map.service.baseUrl}";
`;

    const tools = map.tools
      .map((tool) => this.generateTool(tool, config))
      .join("\n");

    const transport = this.generateTransport(config, map.service.name);

    return `${imports}\n${serverInit}\n${tools}\n${transport}`;
  }

  generateAuth(auth: AuthConfig, config: GeneratorConfig): string {
    switch (auth.type) {
      case "bearer":
        return `
import type { RequestInit } from "node-fetch";

const API_TOKEN = process.env.API_TOKEN;

if (!API_TOKEN) {
  console.warn("Warning: API_TOKEN not set. Set it in .env or environment.");
}

export async function apiClient(path: string, options: RequestInit = {}): Promise<Response> {
  const url = \`\${process.env.API_BASE_URL || ""}\${path}\`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  if (API_TOKEN) {
    headers["Authorization"] = \`Bearer \${API_TOKEN}\`;
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(\`API error \${res.status}: \${res.statusText}. \${body}\`);
  }

  return res;
}
`;

      case "api_key":
        return `
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("Warning: API_KEY not set. Set it in .env or environment.");
}

export async function apiClient(path: string, options: RequestInit = {}): Promise<Response> {
  const url = \`\${process.env.API_BASE_URL || ""}\${path}\`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ${auth.headerName ? `"${auth.headerName}": API_KEY || "",` : ""}
    ...(options.headers as Record<string, string> || {}),
  };

  ${auth.queryParamName ? `const sep = url.includes("?") ? "&" : "?";
  const fullUrl = \`\${url}\${sep}${auth.queryParamName}=\${API_KEY}\`;` : "const fullUrl = url;"}

  const res = await fetch(${auth.queryParamName ? "fullUrl" : "url"}, { ...options, headers });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(\`API error \${res.status}: \${res.statusText}. \${body}\`);
  }

  return res;
}
`;

      default:
        return `
export async function apiClient(path: string, options: RequestInit = {}): Promise<Response> {
  const url = \`\${process.env.API_BASE_URL || ""}\${path}\`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(\`API error \${res.status}: \${res.statusText}. \${body}\`);
  }

  return res;
}
`;
    }
  }

  generateTypes(types: TypeDefinition[], config: GeneratorConfig): string {
    return types
      .map((t) => {
        const props = Object.entries(t.properties)
          .map(([name, def]) => {
            const optional = def.required ? "" : "?";
            const comment = def.description ? `  /** ${def.description} */\n` : "";
            return `${comment}  ${name}${optional}: ${this.tsType(def.type)};`;
          })
          .join("\n");

        const comment = t.description ? `/** ${t.description} */\n` : "";
        return `${comment}export interface ${t.name} {\n${props}\n}`;
      })
      .join("\n\n");
  }

  // ─── Private Helpers ─────────────────────────────────────

  private generateToolBody(tool: ToolDefinition): string {
    if (!tool.source) {
      return `// TODO: Implement ${tool.name}
    return { content: [{ type: "text", text: "Not implemented" }] };`;
    }

    const { method, path } = tool.source;
    const pathParams = tool.parameters.filter((p) => p.location === "path");
    const queryParams = tool.parameters.filter((p) => p.location === "query");
    const bodyParams = tool.parameters.filter((p) => p.location === "body");

    // Build path with interpolation
    let pathExpr = `\`${path}\``;
    for (const p of pathParams) {
      pathExpr = pathExpr.replace(`{${p.name}}`, `\${${p.name}}`);
    }

    // Build query string
    let queryStr = "";
    if (queryParams.length > 0) {
      queryStr = `
    const params = new URLSearchParams();
    ${queryParams.map((p) => `if (${p.name} !== undefined) params.set("${p.name}", String(${p.name}));`).join("\n    ")}
    const qs = params.toString() ? \`?\${params.toString()}\` : "";`;
      pathExpr = pathExpr.replace("`", "`") + " + qs";
    }

    // Build body
    let bodyStr = "";
    if (bodyParams.length > 0 && method !== "GET") {
      const bodyObj = bodyParams.map((p) => p.name).join(", ");
      bodyStr = `,\n      body: JSON.stringify({ ${bodyObj} })`;
    }

    return `${queryStr}
    const res = await apiClient(${pathExpr}, {
      method: "${method}"${bodyStr}
    });
    const data = await res.json();
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };`;
  }

  private generateTransport(config: GeneratorConfig, serviceName: string): string {
    if (config.transport === "stdio") {
      return `
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(\`\${server.name} MCP server running on stdio\`);
`;
    }

    return `
// SSE Transport — HTTP server
const PORT = parseInt(process.env.PORT || "3000");
const httpServer = createServer();

const transports = new Map<string, SSEServerTransport>();

httpServer.on("request", async (req, res) => {
  const url = new URL(req.url || "/", \`http://localhost:\${PORT}\`);

  // Health check
  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", name: "${this.escapeString(serviceName)}" }));
    return;
  }

  // SSE endpoint
  if (url.pathname === "/sse" && req.method === "GET") {
    const transport = new SSEServerTransport("/messages", res);
    transports.set(transport.sessionId, transport);
    await server.connect(transport);
    return;
  }

  // Message endpoint
  if (url.pathname === "/messages" && req.method === "POST") {
    const sessionId = url.searchParams.get("sessionId");
    const transport = sessionId ? transports.get(sessionId) : undefined;
    if (transport) {
      let body = "";
      req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      req.on("end", async () => {
        await transport.handlePostMessage(req, res, body);
      });
    } else {
      res.writeHead(404);
      res.end("Session not found");
    }
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

httpServer.listen(PORT, () => {
  console.log(\`MCP server listening on http://localhost:\${PORT}/sse\`);
});
`;
  }

  private toZodType(type: string, schema?: Record<string, unknown>): string {
    switch (type) {
      case "string":
        return "string()";
      case "number":
        return "number()";
      case "boolean":
        return "boolean()";
      case "Date":
        return "string()";
      case "object":
        return "record(z.unknown())";
      default:
        if (type.endsWith("[]")) {
          const inner = this.toZodType(type.slice(0, -2));
          return `array(z.${inner})`;
        }
        return "unknown()";
    }
  }

  private tsType(type: string): string {
    switch (type) {
      case "Date":
        return "string";
      case "object":
        return "Record<string, unknown>";
      default:
        return type;
    }
  }

  private escapeString(s: string): string {
    return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
  }
}
