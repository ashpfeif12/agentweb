/**
 * AgentWeb Middleware — MCP Server
 *
 * The "Cloudflare for agents". An MCP server that sits in front
 * of any website and makes it agent-consumable.
 *
 * Agents connect to this server and get tools to:
 *   - Search and browse the site content
 *   - Query structured data (products, articles, etc.)
 *   - Check policies (returns, shipping, availability)
 *   - Get brand information
 *   - Trigger human escalation when needed
 *
 * Site owners configure it with their URL and optional agent.json.
 * No changes needed on the origin site.
 *
 * Usage:
 *   ORIGIN_URL=https://example.com npx agentweb-middleware
 *   ORIGIN_URL=https://example.com AGENT_JSON=./agent.json npx agentweb-middleware
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";
import {
  type ProxyConfig,
  ContentCache,
  RateLimiter,
  extractStructuredContent,
  extractProducts,
  filterBrandVoice,
  shouldEscalate,
} from "./services/proxy.js";
import { Analytics } from "./services/analytics.js";

// ─── Configuration ───────────────────────────────────────────

const ORIGIN = process.env.ORIGIN_URL || process.env.ORIGIN || "";
const PORT = parseInt(process.env.PORT || "3000");
const CACHE_TTL = parseInt(process.env.CACHE_TTL || "300");
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT || "100");

if (!ORIGIN) {
  console.error("Error: ORIGIN_URL environment variable is required.");
  console.error("Usage: ORIGIN_URL=https://example.com npx agentweb-middleware");
  process.exit(1);
}

// Load agent.json if provided
let agentJson: Record<string, unknown> | undefined;
if (process.env.AGENT_JSON) {
  try {
    const fs = await import("fs");
    agentJson = JSON.parse(fs.readFileSync(process.env.AGENT_JSON, "utf-8"));
    console.error(`Loaded agent.json from ${process.env.AGENT_JSON}`);
  } catch (e) {
    console.error(`Warning: Could not load agent.json from ${process.env.AGENT_JSON}: ${e}`);
  }
}

const config: ProxyConfig = {
  origin: ORIGIN.replace(/\/+$/, ""),
  agentJson,
  cacheTtlSeconds: CACHE_TTL,
  rateLimitPerMinute: RATE_LIMIT,
  brandVoice: agentJson?.brand_voice as ProxyConfig["brandVoice"],
  escalationTriggers: (agentJson?.humans as Record<string, unknown>)?.triggers as string[] || ["complaint", "legal_question"],
};

const siteName = (agentJson?.name as string) || new URL(config.origin).hostname;

// ─── Initialize Services ─────────────────────────────────────

const cache = new ContentCache(config.cacheTtlSeconds);
const rateLimiter = new RateLimiter(config.rateLimitPerMinute);
const analytics = new Analytics();

// ─── MCP Server ──────────────────────────────────────────────

const server = new McpServer({
  name: `${siteName}-middleware`,
  version: "0.1.0",
});

// ─── Helper: Fetch from origin ───────────────────────────────

async function fetchOrigin(path: string): Promise<string> {
  const url = path.startsWith("http") ? path : `${config.origin}${path}`;
  const cached = cache.get(url);
  if (cached) return cached.content;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "AgentWeb-Middleware/0.1 (+https://agentweb.dev)",
      "Accept": "text/html,application/json",
    },
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`Origin returned ${res.status}: ${res.statusText}`);
  }

  const html = await res.text();
  const structured = extractStructuredContent(html, url);
  cache.set(structured);
  return structured.content;
}

async function fetchStructured(path: string) {
  const url = path.startsWith("http") ? path : `${config.origin}${path}`;
  const cached = cache.get(url);
  if (cached) return cached;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "AgentWeb-Middleware/0.1 (+https://agentweb.dev)",
      "Accept": "text/html,application/json",
    },
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`Origin returned ${res.status}: ${res.statusText}`);
  }

  const html = await res.text();
  const structured = extractStructuredContent(html, url);
  cache.set(structured);
  return structured;
}

// ─── Tool: Browse site ───────────────────────────────────────

server.registerTool(
  "browse_site",
  {
    title: `Browse ${siteName}`,
    description: `Browse and read content from ${siteName} (${config.origin}). Returns the main text content of a page. Use this to explore the site, read articles, view product pages, or find information.`,
    inputSchema: {
      path: z.string()
        .default("/")
        .describe("URL path to browse (e.g. '/', '/about', '/products/shoes'). Relative to site root."),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ path }) => {
    const start = Date.now();
    try {
      const data = await fetchStructured(path);
      const { content, violations } = filterBrandVoice(
        `# ${data.title}\n\n${data.description}\n\n${data.content}`,
        config.brandVoice
      );

      analytics.track({
        timestamp: Date.now(), agentId: "unknown", tool: "browse_site",
        query: path, originUrl: config.origin + path,
        responseTimeMs: Date.now() - start, cached: !!cache.get(config.origin + path),
        escalated: false, brandViolations: violations.length,
      });

      return { content: [{ type: "text" as const, text: content }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: `Error browsing ${path}: ${e}` }], isError: true };
    }
  }
);

// ─── Tool: Search site ───────────────────────────────────────

server.registerTool(
  "search_site",
  {
    title: `Search ${siteName}`,
    description: `Search for content on ${siteName}. Returns matching pages with titles and descriptions. Use this when looking for specific information, products, or pages.`,
    inputSchema: {
      query: z.string().min(1).describe("Search query — what are you looking for?"),
      limit: z.number().int().min(1).max(20).default(5).describe("Maximum number of results"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ query, limit }) => {
    const start = Date.now();
    try {
      // Fetch the site's sitemap or main page to find relevant content
      const mainPage = await fetchStructured("/");
      const links = mainPage.links;

      // Simple text matching against page titles and link text
      const queryLower = query.toLowerCase();
      const matches = links
        .filter(l => l.text.toLowerCase().includes(queryLower) || l.href.toLowerCase().includes(queryLower))
        .slice(0, limit)
        .map(l => ({
          title: l.text,
          url: l.href.startsWith("http") ? l.href : `${config.origin}${l.href}`,
        }));

      analytics.track({
        timestamp: Date.now(), agentId: "unknown", tool: "search_site",
        query, originUrl: config.origin,
        responseTimeMs: Date.now() - start, cached: false,
        escalated: false, brandViolations: 0,
      });

      if (matches.length === 0) {
        return { content: [{ type: "text" as const, text: `No results found for "${query}" on ${siteName}. Try a broader search or browse the site directly.` }] };
      }

      const result = `Found ${matches.length} results for "${query}" on ${siteName}:\n\n` +
        matches.map((m, i) => `${i + 1}. **${m.title}**\n   ${m.url}`).join("\n\n");

      return { content: [{ type: "text" as const, text: result }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: `Search failed: ${e}` }], isError: true };
    }
  }
);

// ─── Tool: Get structured data ───────────────────────────────

server.registerTool(
  "get_structured_data",
  {
    title: `Get structured data from ${siteName}`,
    description: `Extract Schema.org structured data (JSON-LD) from a page on ${siteName}. Returns products, articles, events, business info, and other structured data types. Useful for getting precise, machine-readable information.`,
    inputSchema: {
      path: z.string().default("/").describe("URL path to extract data from"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ path }) => {
    const start = Date.now();
    try {
      const data = await fetchStructured(path);

      analytics.track({
        timestamp: Date.now(), agentId: "unknown", tool: "get_structured_data",
        query: path, originUrl: config.origin + path,
        responseTimeMs: Date.now() - start, cached: !!cache.get(config.origin + path),
        escalated: false, brandViolations: 0,
      });

      if (data.structuredData.length === 0) {
        return { content: [{ type: "text" as const, text: `No structured data found on ${path}. The page may not have Schema.org JSON-LD markup.` }] };
      }

      const products = extractProducts(data.structuredData);
      let result = `Structured data from ${siteName}${path}:\n\n`;

      if (products.length > 0) {
        result += `**Products (${products.length}):**\n\n`;
        for (const p of products) {
          result += `- **${p.name}** — ${p.price ? `$${p.price}` : "Price not listed"} — ${p.availability || "Unknown availability"}\n`;
          if (p.description) result += `  ${p.description.substring(0, 150)}\n`;
        }
        result += "\n";
      }

      result += `**Raw JSON-LD (${data.structuredData.length} objects):**\n\n`;
      result += "```json\n" + JSON.stringify(data.structuredData, null, 2).substring(0, 3000) + "\n```";

      return { content: [{ type: "text" as const, text: result }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: `Error extracting data: ${e}` }], isError: true };
    }
  }
);

// ─── Tool: Get policies ──────────────────────────────────────

server.registerTool(
  "get_policies",
  {
    title: `Get ${siteName} policies`,
    description: `Get business policies for ${siteName}: returns, shipping, rate limits, terms of service, data handling. Use this before making purchase recommendations or handling customer service inquiries.`,
    inputSchema: {
      policy_type: z.enum(["all", "returns", "shipping", "terms", "privacy", "rate_limits"])
        .default("all")
        .describe("Which policy to retrieve"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ policy_type }) => {
    // Pull from agent.json if available
    const policies = agentJson?.policies as Record<string, unknown> | undefined;
    const businessPolicies = policies?.business_policies as Record<string, string> | undefined;

    let result = `**${siteName} Policies**\n\n`;

    if (policies) {
      if (policy_type === "all" || policy_type === "rate_limits") {
        result += `**Rate Limit:** ${policies.rate_limit || "Not specified"}\n`;
        result += `**Data Handling:** ${policies.data_handling || "Not specified"}\n\n`;
      }

      if (businessPolicies) {
        if (policy_type === "all" || policy_type === "returns") {
          result += businessPolicies.returns ? `**Returns:** ${businessPolicies.returns}\n\n` : "";
        }
        if (policy_type === "all" || policy_type === "shipping") {
          result += businessPolicies.shipping ? `**Shipping:** ${businessPolicies.shipping}\n\n` : "";
        }
      }

      if (policy_type === "all" || policy_type === "terms") {
        result += policies.terms_url ? `**Terms of Service:** ${policies.terms_url}\n` : "";
      }
    } else {
      result += "No agent.json found for this site. Policies are not machine-readable.\n";
      result += `Try browsing ${config.origin}/terms or ${config.origin}/privacy for human-readable policies.\n`;
    }

    return { content: [{ type: "text" as const, text: result }] };
  }
);

// ─── Tool: Get brand info ────────────────────────────────────

server.registerTool(
  "get_brand_info",
  {
    title: `About ${siteName}`,
    description: `Get brand information, description, and voice guidelines for ${siteName}. Use this to understand how to represent the brand when talking to users about it.`,
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async () => {
    let result = `**${siteName}**\n\n`;

    if (agentJson) {
      result += `**Description:** ${agentJson.description || "Not provided"}\n\n`;

      const bv = agentJson.brand_voice as Record<string, unknown> | undefined;
      if (bv) {
        result += `**Brand Voice:**\n`;
        result += `- Tone: ${bv.tone || "Not specified"}\n`;
        if (bv.preferred_name) result += `- Preferred name: ${bv.preferred_name}\n`;
        if (Array.isArray(bv.prohibited) && bv.prohibited.length > 0) {
          result += `- Do NOT: ${(bv.prohibited as string[]).join(", ")}\n`;
        }
        if (Array.isArray(bv.required_disclosures) && bv.required_disclosures.length > 0) {
          result += `- Required disclosures: ${(bv.required_disclosures as string[]).join("; ")}\n`;
        }
      }

      const caps = agentJson.capabilities as Array<Record<string, unknown>> | undefined;
      if (caps) {
        result += `\n**Capabilities (${caps.length}):**\n`;
        for (const cap of caps) {
          result += `- ${cap.name}: ${cap.description} (${cap.type})\n`;
        }
      }

      const endpoints = agentJson.endpoints as Record<string, string> | undefined;
      if (endpoints) {
        result += `\n**Endpoints:**\n`;
        for (const [proto, url] of Object.entries(endpoints)) {
          result += `- ${proto}: ${url}\n`;
        }
      }
    } else {
      result += `No agent.json available. This site has not declared its capabilities for agents.\n`;
      result += `Origin: ${config.origin}\n`;
    }

    return { content: [{ type: "text" as const, text: result }] };
  }
);

// ─── Tool: Request human help ────────────────────────────────

server.registerTool(
  "request_human_help",
  {
    title: "Request human assistance",
    description: `Escalate to a human support agent at ${siteName}. Use this when the user's request is too complex for automated handling, involves complaints, legal questions, or any situation where human judgment is needed.`,
    inputSchema: {
      reason: z.string().describe("Why human assistance is needed"),
      context: z.string().describe("Summary of the conversation so far for handoff"),
      urgency: z.enum(["low", "medium", "high"]).default("medium").describe("How urgent is this?"),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  async ({ reason, context, urgency }) => {
    const humans = agentJson?.humans as Record<string, unknown> | undefined;
    const channels = (humans?.channels || []) as Array<Record<string, string>>;

    let result = `**Escalation to human support at ${siteName}**\n\n`;
    result += `**Reason:** ${reason}\n`;
    result += `**Urgency:** ${urgency}\n\n`;

    if (channels.length > 0) {
      result += `**Available support channels:**\n`;
      for (const ch of channels) {
        result += `- ${ch.type}: ${ch.url}${ch.hours ? ` (${ch.hours})` : ""}\n`;
      }
    } else {
      result += `Contact ${siteName} directly at ${config.origin}/contact for human assistance.\n`;
    }

    result += `\n**Context to share with the human agent:**\n${context}\n`;

    analytics.track({
      timestamp: Date.now(), agentId: "unknown", tool: "request_human_help",
      query: reason, originUrl: config.origin,
      responseTimeMs: 0, cached: false, escalated: true, brandViolations: 0,
    });

    return { content: [{ type: "text" as const, text: result }] };
  }
);

// ─── Tool: Analytics (admin) ─────────────────────────────────

server.registerTool(
  "get_analytics",
  {
    title: "Middleware analytics",
    description: "Get analytics about agent traffic through this middleware. Shows request counts, top queries, cache hit rates, and escalation metrics. Admin tool for site owners.",
    inputSchema: {
      period_hours: z.number().default(1).describe("How many hours of data to show"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ period_hours }) => {
    const sinceMs = Date.now() - (period_hours * 3600000);
    const summary = analytics.summary(sinceMs);
    const cacheStats = cache.stats();

    let result = `**Middleware Analytics — ${siteName}**\n`;
    result += `Period: last ${period_hours} hour(s)\n\n`;
    result += `**Traffic:** ${summary.totalRequests} requests from ${summary.uniqueAgents} agent(s)\n`;
    result += `**Throughput:** ${summary.requestsPerMinute} req/min\n`;
    result += `**Avg Response:** ${summary.avgResponseTimeMs}ms\n`;
    result += `**Cache:** ${Math.round(summary.cacheHitRate * 100)}% hit rate (${cacheStats.entries} entries)\n`;
    result += `**Escalations:** ${Math.round(summary.escalationRate * 100)}%\n`;
    result += `**Brand Violations:** ${summary.brandViolationCount}\n`;

    if (summary.topTools.length > 0) {
      result += `\n**Top Tools:**\n`;
      for (const t of summary.topTools) {
        result += `- ${t.tool}: ${t.count} calls\n`;
      }
    }

    if (summary.topQueries.length > 0) {
      result += `\n**Top Queries:**\n`;
      for (const q of summary.topQueries) {
        result += `- "${q.query}": ${q.count}x\n`;
      }
    }

    return { content: [{ type: "text" as const, text: result }] };
  }
);

// ─── HTTP Server + Transport ─────────────────────────────────

const app = express();
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    name: `${siteName}-middleware`,
    origin: config.origin,
    cache: cache.stats(),
    uptime: Math.round(process.uptime()),
  });
});

// agent.json endpoint — serve the site's agent.json (or generate one)
app.get("/agent.json", (_req, res) => {
  if (agentJson) {
    res.json(agentJson);
  } else {
    res.json({
      name: siteName,
      spec_version: "1.0",
      description: `${siteName} — proxied by AgentWeb Middleware`,
      capabilities: [
        { name: "browse_site", description: "Browse and read site content", type: "query" },
        { name: "search_site", description: "Search for content", type: "query" },
        { name: "get_structured_data", description: "Extract structured data", type: "query" },
        { name: "get_policies", description: "Get business policies", type: "query" },
        { name: "get_brand_info", description: "Get brand information", type: "query" },
        { name: "request_human_help", description: "Escalate to human support", type: "action" },
      ],
      endpoints: { mcp: `http://localhost:${PORT}/mcp` },
      policies: { rate_limit: `${config.rateLimitPerMinute}/minute` },
    });
  }
});

// Analytics dashboard endpoint
app.get("/analytics", (_req, res) => {
  const hours = parseInt((_req.query as Record<string, string>).hours || "1");
  res.json(analytics.summary(Date.now() - hours * 3600000));
});

// MCP endpoint (Streamable HTTP)
app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(PORT, () => {
  console.error(`
  ╔═══════════════════════════════════════════════════╗
  ║   AgentWeb Middleware                             ║
  ╚═══════════════════════════════════════════════════╝

  Origin:     ${config.origin}
  Site:       ${siteName}
  MCP:        http://localhost:${PORT}/mcp
  Health:     http://localhost:${PORT}/health
  agent.json: http://localhost:${PORT}/agent.json
  Analytics:  http://localhost:${PORT}/analytics

  Rate Limit: ${config.rateLimitPerMinute}/minute
  Cache TTL:  ${config.cacheTtlSeconds}s
  agent.json: ${agentJson ? "Loaded" : "Not found (auto-generating)"}
  `);
});
