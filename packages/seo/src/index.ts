#!/usr/bin/env node
/**
 * AgentWeb SEO — MCP Server
 *
 * The "Moz for agent discovery". Analyzes how AI agents discover,
 * rank, and recommend your brand, and provides optimization guidance.
 *
 * Usage:
 *   npx agentweb-seo [options]
 *
 * Options:
 *   --port <n>        Port to listen on (default: 3002)
 *   --site <url>      Site URL to analyze
 *   --brand <n>    Brand name
 *   --help, -h        Show this help
 *
 * Env vars (used when flag is not provided):
 *   PORT, SITE_URL, BRAND_NAME
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";
import {
  scoreVisibility,
  QueryMonitor,
  type SiteAnalysis,
  type VisibilityScore,
} from "./services/visibility.js";

// ─── CLI Argument Parsing ────────────────────────────────────

const argv = process.argv.slice(2);

if (argv.includes("--help") || argv.includes("-h")) {
  console.log(`
  AgentWeb SEO — MCP server for agent discovery analytics

  Usage:
    npx agentweb-seo [options]

  Options:
    --port <n>        Port to listen on (default: 3002)
    --site <url>      Site URL to analyze by default
    --brand <n>    Brand name shown to agents
    --help, -h        Show this help

  Environment variables (used when a flag is not provided):
    PORT, SITE_URL, BRAND_NAME

  Examples:
    npx agentweb-seo --site https://acme.com --brand "Acme"
    SITE_URL=https://acme.com npx agentweb-seo
`);
  process.exit(0);
}

function getArg(flag: string): string | undefined {
  const idx = argv.indexOf(flag);
  return idx !== -1 && idx + 1 < argv.length ? argv[idx + 1] : undefined;
}

const PORT = parseInt(getArg("--port") || process.env.PORT || "3002");
const SITE_URL = getArg("--site") || process.env.SITE_URL || "";
const BRAND_NAME = getArg("--brand") || process.env.BRAND_NAME || "My Brand";

const queryMonitor = new QueryMonitor();

const server = new McpServer({
  name: `${BRAND_NAME}-seo`,
  version: "0.1.0",
});

// ─── Tool: Visibility score ──────────────────────────────────

server.registerTool(
  "get_visibility_score",
  {
    title: "Agent visibility score",
    description: `Get the agent visibility score for ${BRAND_NAME || "your site"}. Shows how well AI agents can discover and recommend your brand across 5 dimensions: discoverability, data quality, policy clarity, brand consistency, and competitive position.`,
    inputSchema: {
      url: z.string().optional().describe("URL to analyze (defaults to configured site)"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async ({ url }) => {
    const targetUrl = url || SITE_URL;
    if (!targetUrl) {
      return { content: [{ type: "text" as const, text: "No URL provided. Set SITE_URL env or pass url parameter." }], isError: true };
    }

    // Analyze the site
    const analysis = await analyzeSite(targetUrl);
    const score = scoreVisibility(analysis);

    let result = `**Agent Visibility Score: ${score.overall}/100**\n\n`;

    const dims = [
      ["Discoverability", score.dimensions.discoverability, "Can agents find you?"],
      ["Data Quality", score.dimensions.dataQuality, "Is structured data complete?"],
      ["Policy Clarity", score.dimensions.policyClarity, "Are rules machine-readable?"],
      ["Brand Consistency", score.dimensions.brandConsistency, "Is brand voice defined?"],
      ["Competitive Position", score.dimensions.competitivePosition, "How do you compare?"],
    ] as const;

    for (const [name, val, desc] of dims) {
      const bar = "█".repeat(Math.round(val / 10)) + "░".repeat(10 - Math.round(val / 10));
      result += `${name.padEnd(22)} ${bar} ${val}/100  ${desc}\n`;
    }

    if (score.recommendations.length > 0) {
      result += `\n**Top Recommendations:**\n\n`;
      for (const rec of score.recommendations.slice(0, 5)) {
        const icon = rec.priority === "high" ? "🔴" : rec.priority === "medium" ? "🟡" : "🟢";
        result += `${icon} **${rec.action}**\n`;
        result += `   Impact: ${rec.impact}\n`;
        result += `   Effort: ${rec.effort}\n\n`;
      }
    }

    return { content: [{ type: "text" as const, text: result }] };
  }
);

// ─── Tool: Query patterns ────────────────────────────────────

server.registerTool(
  "get_query_patterns",
  {
    title: "Agent query analytics",
    description: "See what agents are asking about your brand — top queries, mention rate, sentiment, and platform breakdown.",
    inputSchema: {
      period_hours: z.number().default(24).describe("Analysis period in hours"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ period_hours }) => {
    const patterns = queryMonitor.getQueryPatterns(Date.now() - period_hours * 3600000);

    let result = `**Agent Query Analytics — ${BRAND_NAME}**\n`;
    result += `Period: last ${period_hours} hours\n\n`;
    result += `Total queries: ${patterns.totalQueries}\n`;
    result += `Brand mention rate: ${Math.round(patterns.mentionRate * 100)}%\n\n`;

    if (patterns.topQueries.length > 0) {
      result += `**Top Queries:**\n`;
      for (const q of patterns.topQueries) {
        result += `- "${q.query}" (${q.count}x) ${q.mentioned ? "✓ mentioned" : "✗ not mentioned"}\n`;
      }
      result += "\n";
    }

    result += `**Sentiment:** ${patterns.sentimentBreakdown.positive} positive, ${patterns.sentimentBreakdown.neutral} neutral, ${patterns.sentimentBreakdown.negative} negative\n\n`;

    if (patterns.platformBreakdown.length > 0) {
      result += `**By Platform:**\n`;
      for (const p of patterns.platformBreakdown) {
        result += `- ${p.platform}: ${p.count} queries, ${Math.round(p.mentionRate * 100)}% mention rate\n`;
      }
    }

    return { content: [{ type: "text" as const, text: result }] };
  }
);

// ─── Tool: Optimization recommendations ──────────────────────

server.registerTool(
  "get_optimization_plan",
  {
    title: "Optimization plan",
    description: `Get a prioritized list of actions to improve ${BRAND_NAME}'s agent visibility. Each recommendation includes impact assessment and implementation effort.`,
    inputSchema: {
      url: z.string().optional().describe("URL to analyze"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async ({ url }) => {
    const targetUrl = url || SITE_URL;
    if (!targetUrl) {
      return { content: [{ type: "text" as const, text: "No URL provided." }], isError: true };
    }

    const analysis = await analyzeSite(targetUrl);
    const score = scoreVisibility(analysis);

    let result = `**Agent SEO Optimization Plan — ${BRAND_NAME}**\n`;
    result += `Current score: ${score.overall}/100\n\n`;

    const high = score.recommendations.filter(r => r.priority === "high");
    const medium = score.recommendations.filter(r => r.priority === "medium");
    const low = score.recommendations.filter(r => r.priority === "low");

    if (high.length > 0) {
      result += `**🔴 High Priority (do these first):**\n\n`;
      for (const r of high) {
        result += `• ${r.action}\n  ${r.impact}\n  How: ${r.effort}\n\n`;
      }
    }

    if (medium.length > 0) {
      result += `**🟡 Medium Priority:**\n\n`;
      for (const r of medium) {
        result += `• ${r.action}\n  ${r.impact}\n  How: ${r.effort}\n\n`;
      }
    }

    if (low.length > 0) {
      result += `**🟢 Low Priority:**\n\n`;
      for (const r of low) {
        result += `• ${r.action}\n  How: ${r.effort}\n\n`;
      }
    }

    // Estimate score improvement
    const potentialGain = score.recommendations
      .filter(r => r.priority !== "low")
      .length * 12; // rough estimate
    result += `**Estimated score after fixes:** ${Math.min(100, score.overall + potentialGain)}/100\n`;

    return { content: [{ type: "text" as const, text: result }] };
  }
);

// ─── Tool: Competitive analysis ──────────────────────────────

server.registerTool(
  "compare_competitors",
  {
    title: "Competitive analysis",
    description: "Compare your agent readiness against competitors. Shows where you lead and where you're behind.",
    inputSchema: {
      competitor_urls: z.array(z.string()).min(1).max(5).describe("Competitor URLs to compare against"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async ({ competitor_urls }) => {
    const myUrl = SITE_URL;
    if (!myUrl) {
      return { content: [{ type: "text" as const, text: "Set SITE_URL to compare." }], isError: true };
    }

    const myAnalysis = await analyzeSite(myUrl);
    const myScore = scoreVisibility(myAnalysis);

    let result = `**Competitive Agent Readiness**\n\n`;
    result += `${BRAND_NAME}: **${myScore.overall}/100**\n\n`;

    for (const compUrl of competitor_urls) {
      const compAnalysis = await analyzeSite(compUrl);
      const compScore = scoreVisibility(compAnalysis);
      const hostname = new URL(compUrl).hostname;

      const diff = myScore.overall - compScore.overall;
      const indicator = diff > 0 ? `+${diff} ahead` : diff < 0 ? `${diff} behind` : "tied";

      result += `**${hostname}:** ${compScore.overall}/100 (${indicator})\n`;

      // Find what they do better
      const dims = Object.entries(compScore.dimensions) as Array<[string, number]>;
      for (const [dim, val] of dims) {
        const myVal = myScore.dimensions[dim as keyof typeof myScore.dimensions];
        if (val > myVal + 10) {
          result += `  ↑ Better ${dim}: ${val} vs your ${myVal}\n`;
        }
      }
      result += "\n";
    }

    return { content: [{ type: "text" as const, text: result }] };
  }
);

// ─── Site Analyzer ───────────────────────────────────────────

async function analyzeSite(url: string): Promise<SiteAnalysis> {
  // In production, this would crawl the site. For now, check basic signals.
  const checks = await Promise.allSettled([
    fetch(`${url}/agent.json`, { signal: AbortSignal.timeout(5000) }).then(r => r.ok),
    fetch(`${url}/llms.txt`, { signal: AbortSignal.timeout(5000) }).then(r => r.ok),
    fetch(`${url}/robots.txt`, { signal: AbortSignal.timeout(5000) }).then(r => r.ok),
    fetch(url, { signal: AbortSignal.timeout(8000) }).then(async r => {
      const html = await r.text();
      return {
        hasSchema: html.includes("application/ld+json"),
        schemaTypes: (html.match(/"@type"\s*:\s*"([^"]+)"/g) || []).map(m => m.replace(/"@type"\s*:\s*"([^"]+)"/, "$1")),
        hasApi: html.includes("/api/") || html.includes("developer") || html.includes("openapi"),
      };
    }),
  ]);

  const hasAgentJson = checks[0].status === "fulfilled" && checks[0].value === true;
  const hasLlmsTxt = checks[1].status === "fulfilled" && checks[1].value === true;
  const pageData = checks[3].status === "fulfilled" ? checks[3].value as { hasSchema: boolean; schemaTypes: string[]; hasApi: boolean } : null;

  return {
    url,
    hasAgentJson,
    agentJsonComplete: hasAgentJson ? 60 : 0, // Would parse and score completeness
    hasLlmsTxt,
    hasMcpEndpoint: false, // Would check agent.json endpoints
    schemaOrgCoverage: pageData?.hasSchema ? 60 : 0,
    schemaOrgTypes: pageData?.schemaTypes || [],
    apiDocumented: pageData?.hasApi || false,
    policiesMachineReadable: hasAgentJson, // If they have agent.json, policies are likely there
    brandVoiceDefined: false, // Would parse agent.json
    escalationPathsDefined: false,
    responseTimeMs: 300, // Would measure
    contentFreshnessDays: 7,
    structuredDataErrors: 0,
  };
}

// ─── HTTP Server ─────────────────────────────────────────────

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", name: `${BRAND_NAME}-seo`, siteUrl: SITE_URL });
});

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
  ║   AgentWeb SEO — Agent Discovery Analytics       ║
  ╚═══════════════════════════════════════════════════╝

  Brand:   ${BRAND_NAME}
  Site:    ${SITE_URL || "(not configured)"}
  MCP:     http://localhost:${PORT}/mcp
  Health:  http://localhost:${PORT}/health
  `);
});
