#!/usr/bin/env tsx

/**
 * AgentWeb Readiness Scorer — Standalone CLI
 *
 * Usage:
 *   tsx run-scorer.ts https://example.com
 *   tsx run-scorer.ts https://site1.com https://site2.com --compare
 *   tsx run-scorer.ts https://example.com --json
 */

// ─── Types ───────────────────────────────────────────────────

interface SiteData {
  url: string;
  agentJson: Record<string, unknown> | null;
  hasAgentJson: boolean;
  hasLlmsTxt: boolean;
  hasRobotsTxt: boolean;
  hasSitemap: boolean;
  hasSchemaOrg: boolean;
  schemaOrgTypes: string[];
  hasOpenApi: boolean;
  hasGraphQL: boolean;
  hasMcpEndpoint: boolean;
  hasRestApi: boolean;
  hasStructuredData: boolean;
  metaDescription: string | null;
  headingStructure: boolean;
  semanticHtml: boolean;
  hasRateLimit: boolean;
  hasTermsOfService: boolean;
  hasPrivacyPolicy: boolean;
  hasContactInfo: boolean;
  responseTimeMs: number;
  httpsEnabled: boolean;
  corsEnabled: boolean;
}

interface Check {
  name: string;
  passed: boolean;
  points: number;
  maxPoints: number;
  detail: string;
  recommendation?: string;
}

interface DimensionScore {
  score: number;
  max: number;
  checks: Check[];
}

interface ScoreBreakdown {
  discovery: DimensionScore;
  structure: DimensionScore;
  actions: DimensionScore;
  policies: DimensionScore;
}

interface ReadinessReport {
  url: string;
  timestamp: string;
  total: number;
  grade: string;
  breakdown: ScoreBreakdown;
  topRecommendations: string[];
}

// ─── Crawler ─────────────────────────────────────────────────

function normalizeUrl(url: string): string {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  return url.replace(/\/+$/, "");
}

async function fetchSafe(
  url: string,
  timeout = 8000
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "AgentWeb-Scorer/1.0 (+https://agentweb.dev)" },
      redirect: "follow",
    });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function crawl(rawUrl: string): Promise<SiteData> {
  const base = normalizeUrl(rawUrl);

  const data: SiteData = {
    url: base,
    agentJson: null,
    hasAgentJson: false,
    hasLlmsTxt: false,
    hasRobotsTxt: false,
    hasSitemap: false,
    hasSchemaOrg: false,
    schemaOrgTypes: [],
    hasOpenApi: false,
    hasGraphQL: false,
    hasMcpEndpoint: false,
    hasRestApi: false,
    hasStructuredData: false,
    metaDescription: null,
    headingStructure: false,
    semanticHtml: false,
    hasRateLimit: false,
    hasTermsOfService: false,
    hasPrivacyPolicy: false,
    hasContactInfo: false,
    responseTimeMs: 0,
    httpsEnabled: base.startsWith("https://"),
    corsEnabled: false,
  };

  const tasks: Array<Promise<void>> = [];

  // 1. agent.json
  tasks.push(
    (async () => {
      const res = await fetchSafe(`${base}/agent.json`);
      if (res?.ok) {
        try {
          data.agentJson = await res.json() as Record<string, unknown>;
          data.hasAgentJson = true;
        } catch { /* invalid json */ }
      }
    })()
  );

  // 2. llms.txt
  tasks.push(
    (async () => {
      const res = await fetchSafe(`${base}/llms.txt`);
      data.hasLlmsTxt = !!res?.ok;
    })()
  );

  // 3. robots.txt
  tasks.push(
    (async () => {
      const res = await fetchSafe(`${base}/robots.txt`);
      data.hasRobotsTxt = !!res?.ok;
    })()
  );

  // 4. sitemap.xml
  tasks.push(
    (async () => {
      const res = await fetchSafe(`${base}/sitemap.xml`);
      data.hasSitemap = !!res?.ok;
    })()
  );

  // 5. Main page analysis
  tasks.push(
    (async () => {
      const start = Date.now();
      const res = await fetchSafe(base, 12000);
      data.responseTimeMs = Date.now() - start;

      if (!res) return;

      data.corsEnabled = res.headers.has("access-control-allow-origin");
      data.hasRateLimit =
        res.headers.has("x-ratelimit-limit") ||
        res.headers.has("ratelimit-limit") ||
        res.headers.has("retry-after");

      if (res.ok) {
        const html = await res.text();
        analyzeHtml(html, data);
      }
    })()
  );

  // 6. Common API paths
  tasks.push(
    (async () => {
      for (const path of ["/openapi.json", "/swagger.json", "/api-docs"]) {
        const res = await fetchSafe(`${base}${path}`, 5000);
        if (res?.ok) {
          data.hasOpenApi = true;
          data.hasRestApi = true;
          break;
        }
      }
    })()
  );

  tasks.push(
    (async () => {
      for (const path of ["/graphql", "/api/graphql"]) {
        const res = await fetchSafe(`${base}${path}`, 5000);
        if (res && (res.ok || res.status === 400)) {
          data.hasGraphQL = true;
          break;
        }
      }
    })()
  );

  await Promise.allSettled(tasks);

  // Derive endpoints from agent.json
  if (data.agentJson?.endpoints) {
    const ep = data.agentJson.endpoints as Record<string, string>;
    if (ep.mcp) data.hasMcpEndpoint = true;
    if (ep.rest) data.hasRestApi = true;
    if (ep.graphql) data.hasGraphQL = true;
  }

  return data;
}

function analyzeHtml(html: string, data: SiteData): void {
  // JSON-LD
  const jsonLdMatches = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  if (jsonLdMatches) {
    data.hasSchemaOrg = true;
    data.hasStructuredData = true;
    for (const match of jsonLdMatches) {
      const content = match.replace(/<script[^>]*>|<\/script>/gi, "");
      try {
        const parsed = JSON.parse(content);
        const t = parsed["@type"];
        if (t) data.schemaOrgTypes.push(...(Array.isArray(t) ? t : [t]));
      } catch { /* skip */ }
    }
  }

  // Microdata / RDFa
  if (
    html.includes("itemscope") ||
    html.includes('itemtype="http://schema.org') ||
    html.includes('vocab="http://schema.org')
  ) {
    data.hasSchemaOrg = true;
    data.hasStructuredData = true;
  }

  // Meta description
  const metaMatch = html.match(
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*?)["']/i
  );
  if (!metaMatch) {
    const metaMatch2 = html.match(
      /<meta[^>]*content=["']([^"']*?)["'][^>]*name=["']description["']/i
    );
    data.metaDescription = metaMatch2?.[1] ?? null;
  } else {
    data.metaDescription = metaMatch[1] ?? null;
  }

  // Semantic HTML
  const semEls = ["<article", "<section", "<nav", "<main", "<aside", "<header", "<footer"];
  data.semanticHtml = semEls.filter((el) => html.includes(el)).length >= 3;

  // Heading structure
  const h1 = (html.match(/<h1[\s>]/gi) || []).length;
  const h2 = (html.match(/<h2[\s>]/gi) || []).length;
  data.headingStructure = h1 >= 1 && h2 > 0;

  // Legal pages
  const lower = html.toLowerCase();
  data.hasTermsOfService =
    lower.includes("terms of service") ||
    lower.includes("terms-of-service") ||
    lower.includes("terms of use") ||
    lower.includes("/tos") ||
    lower.includes("/terms");

  data.hasPrivacyPolicy =
    lower.includes("privacy policy") ||
    lower.includes("privacy-policy") ||
    lower.includes("/privacy");

  data.hasContactInfo =
    lower.includes("contact us") ||
    lower.includes("/contact") ||
    lower.includes("mailto:");
}

// ─── Scorer ──────────────────────────────────────────────────

function scoreDiscovery(data: SiteData): DimensionScore {
  const checks: Check[] = [];

  checks.push({
    name: "agent.json manifest",
    passed: data.hasAgentJson,
    points: data.hasAgentJson ? 10 : 0,
    maxPoints: 10,
    detail: data.hasAgentJson ? "Found agent.json at domain root" : "No agent.json found",
    recommendation: data.hasAgentJson ? undefined : "Create an agent.json file at your domain root describing your capabilities",
  });

  const hasDesc =
    data.agentJson?.description &&
    typeof data.agentJson.description === "string" &&
    (data.agentJson.description as string).length >= 20;
  checks.push({
    name: "Service description",
    passed: !!hasDesc,
    points: hasDesc ? 3 : 0,
    maxPoints: 3,
    detail: hasDesc ? "Good description for agent decision-making" : "Missing or too-short service description",
    recommendation: hasDesc ? undefined : "Add a 50-200 character description of what your service does",
  });

  const hasCaps =
    data.agentJson &&
    Array.isArray(data.agentJson.capabilities) &&
    (data.agentJson.capabilities as unknown[]).length > 0;
  checks.push({
    name: "Capabilities declared",
    passed: !!hasCaps,
    points: hasCaps ? 4 : 0,
    maxPoints: 4,
    detail: hasCaps
      ? `${(data.agentJson!.capabilities as unknown[]).length} capabilities declared`
      : "No capabilities declared",
    recommendation: hasCaps ? undefined : "List what agents can do with your service in the capabilities array",
  });

  checks.push({
    name: "llms.txt",
    passed: data.hasLlmsTxt,
    points: data.hasLlmsTxt ? 3 : 0,
    maxPoints: 3,
    detail: data.hasLlmsTxt ? "Found llms.txt" : "No llms.txt found",
    recommendation: data.hasLlmsTxt ? undefined : "Add an llms.txt file with context for LLM consumption",
  });

  checks.push({
    name: "robots.txt",
    passed: data.hasRobotsTxt,
    points: data.hasRobotsTxt ? 2 : 0,
    maxPoints: 2,
    detail: data.hasRobotsTxt ? "robots.txt present" : "No robots.txt",
  });

  checks.push({
    name: "Sitemap",
    passed: data.hasSitemap,
    points: data.hasSitemap ? 3 : 0,
    maxPoints: 3,
    detail: data.hasSitemap ? "Sitemap found" : "No sitemap found",
    recommendation: data.hasSitemap ? undefined : "Add a sitemap.xml for agent crawlability",
  });

  return { score: checks.reduce((s, c) => s + c.points, 0), max: 25, checks };
}

function scoreStructure(data: SiteData): DimensionScore {
  const checks: Check[] = [];

  checks.push({
    name: "Schema.org markup",
    passed: data.hasSchemaOrg,
    points: data.hasSchemaOrg ? 8 : 0,
    maxPoints: 8,
    detail: data.hasSchemaOrg
      ? `Schema.org types: ${data.schemaOrgTypes.join(", ") || "detected"}`
      : "No Schema.org structured data",
    recommendation: data.hasSchemaOrg ? undefined : "Add Schema.org markup (JSON-LD) to your pages",
  });

  checks.push({
    name: "Semantic HTML",
    passed: data.semanticHtml,
    points: data.semanticHtml ? 4 : 0,
    maxPoints: 4,
    detail: data.semanticHtml ? "Uses semantic HTML elements" : "Limited semantic HTML",
    recommendation: data.semanticHtml ? undefined : "Use <article>, <nav>, <section>, <main> elements",
  });

  checks.push({
    name: "Heading hierarchy",
    passed: data.headingStructure,
    points: data.headingStructure ? 3 : 0,
    maxPoints: 3,
    detail: data.headingStructure ? "Proper heading hierarchy" : "Heading hierarchy issues",
  });

  checks.push({
    name: "Meta description",
    passed: !!data.metaDescription,
    points: data.metaDescription ? 2 : 0,
    maxPoints: 2,
    detail: data.metaDescription ? "Meta description present" : "No meta description",
  });

  const hasSchemas =
    data.agentJson &&
    Array.isArray(data.agentJson.data_schemas) &&
    (data.agentJson.data_schemas as unknown[]).length > 0;
  checks.push({
    name: "Data schemas declared",
    passed: !!hasSchemas,
    points: hasSchemas ? 5 : 0,
    maxPoints: 5,
    detail: hasSchemas ? "Data schemas in agent.json" : "No data schemas in agent.json",
    recommendation: hasSchemas ? undefined : "Define data_schemas in agent.json so agents know your data shape",
  });

  checks.push({
    name: "HTTPS",
    passed: data.httpsEnabled,
    points: data.httpsEnabled ? 3 : 0,
    maxPoints: 3,
    detail: data.httpsEnabled ? "HTTPS enabled" : "No HTTPS",
  });

  return { score: checks.reduce((s, c) => s + c.points, 0), max: 25, checks };
}

function scoreActions(data: SiteData): DimensionScore {
  const checks: Check[] = [];

  const hasApi = data.hasOpenApi || data.hasGraphQL || data.hasRestApi;
  const apiTypes = [
    data.hasOpenApi && "OpenAPI",
    data.hasGraphQL && "GraphQL",
    data.hasRestApi && "REST",
  ].filter(Boolean);

  checks.push({
    name: "API availability",
    passed: hasApi,
    points: hasApi ? 8 : 0,
    maxPoints: 8,
    detail: hasApi ? `API detected: ${apiTypes.join(", ")}` : "No API detected",
    recommendation: hasApi ? undefined : "Expose an API so agents can interact programmatically",
  });

  checks.push({
    name: "MCP endpoint",
    passed: data.hasMcpEndpoint,
    points: data.hasMcpEndpoint ? 7 : 0,
    maxPoints: 7,
    detail: data.hasMcpEndpoint ? "MCP server endpoint available" : "No MCP endpoint",
    recommendation: data.hasMcpEndpoint ? undefined : "Deploy an MCP server — run `npx agentweb generate` from your API spec",
  });

  const hasActions =
    data.agentJson &&
    Array.isArray(data.agentJson.actions) &&
    (data.agentJson.actions as unknown[]).length > 0;
  checks.push({
    name: "Actions defined",
    passed: !!hasActions,
    points: hasActions ? 6 : 0,
    maxPoints: 6,
    detail: hasActions
      ? `${(data.agentJson!.actions as unknown[]).length} actions with schemas`
      : "No actions defined in agent.json",
    recommendation: hasActions ? undefined : "Define actions in agent.json with input/output schemas",
  });

  checks.push({
    name: "CORS headers",
    passed: data.corsEnabled,
    points: data.corsEnabled ? 2 : 0,
    maxPoints: 2,
    detail: data.corsEnabled ? "CORS enabled" : "CORS not detected",
  });

  const fast = data.responseTimeMs > 0 && data.responseTimeMs < 500;
  checks.push({
    name: "Response time",
    passed: fast,
    points: fast ? 2 : 0,
    maxPoints: 2,
    detail: data.responseTimeMs > 0
      ? `${data.responseTimeMs}ms${fast ? "" : " (>500ms — slow for agents)"}`
      : "Could not measure",
  });

  return { score: checks.reduce((s, c) => s + c.points, 0), max: 25, checks };
}

function scorePolicies(data: SiteData): DimensionScore {
  const checks: Check[] = [];

  const pol = data.agentJson?.policies as Record<string, unknown> | undefined;

  const hasRatePolicy = pol && typeof pol.rate_limit === "string";
  checks.push({
    name: "Rate limit policy",
    passed: !!(data.hasRateLimit || hasRatePolicy),
    points: data.hasRateLimit || hasRatePolicy ? 5 : 0,
    maxPoints: 5,
    detail: data.hasRateLimit || hasRatePolicy ? "Rate limiting configured" : "No rate limit policy",
    recommendation: data.hasRateLimit || hasRatePolicy ? undefined : "Define rate limits so agents know their boundaries",
  });

  const hasAuth = !!data.agentJson?.authentication;
  checks.push({
    name: "Authentication defined",
    passed: hasAuth,
    points: hasAuth ? 5 : 0,
    maxPoints: 5,
    detail: hasAuth ? "Authentication method defined" : "No auth method specified",
    recommendation: hasAuth ? undefined : "Define how agents should authenticate",
  });

  const hasDataPolicy = pol && typeof pol.data_handling === "string";
  checks.push({
    name: "Data handling policy",
    passed: !!hasDataPolicy,
    points: hasDataPolicy ? 4 : 0,
    maxPoints: 4,
    detail: hasDataPolicy ? "Data handling rules specified" : "No data handling policy",
    recommendation: hasDataPolicy ? undefined : "Specify how agent platforms should handle interaction data",
  });

  const hasBV = !!data.agentJson?.brand_voice;
  checks.push({
    name: "Brand voice guidelines",
    passed: hasBV,
    points: hasBV ? 4 : 0,
    maxPoints: 4,
    detail: hasBV ? "Brand voice defined" : "No brand voice guidelines",
    recommendation: hasBV ? undefined : "Add brand_voice to control how agents represent you",
  });

  const hasEsc = !!data.agentJson?.humans;
  checks.push({
    name: "Human escalation paths",
    passed: hasEsc,
    points: hasEsc ? 4 : 0,
    maxPoints: 4,
    detail: hasEsc ? "Escalation paths defined" : "No human escalation",
    recommendation: hasEsc ? undefined : "Define when agent interactions should escalate to humans",
  });

  const termsPts = (data.hasTermsOfService ? 1.5 : 0) + (data.hasPrivacyPolicy ? 1.5 : 0);
  checks.push({
    name: "Terms & Privacy",
    passed: data.hasTermsOfService && data.hasPrivacyPolicy,
    points: termsPts,
    maxPoints: 3,
    detail: `ToS: ${data.hasTermsOfService ? "✓" : "✗"}, Privacy: ${data.hasPrivacyPolicy ? "✓" : "✗"}`,
  });

  return { score: Math.round(checks.reduce((s, c) => s + c.points, 0)), max: 25, checks };
}

function getGrade(total: number): string {
  if (total >= 90) return "A+";
  if (total >= 80) return "A";
  if (total >= 70) return "B";
  if (total >= 60) return "C";
  if (total >= 50) return "D";
  return "F";
}

function score(data: SiteData): ReadinessReport {
  const breakdown: ScoreBreakdown = {
    discovery: scoreDiscovery(data),
    structure: scoreStructure(data),
    actions: scoreActions(data),
    policies: scorePolicies(data),
  };

  const total =
    breakdown.discovery.score +
    breakdown.structure.score +
    breakdown.actions.score +
    breakdown.policies.score;

  const allChecks = [
    ...breakdown.discovery.checks,
    ...breakdown.structure.checks,
    ...breakdown.actions.checks,
    ...breakdown.policies.checks,
  ];

  const topRecommendations = allChecks
    .filter((c) => !c.passed && c.recommendation)
    .sort((a, b) => b.maxPoints - a.maxPoints)
    .slice(0, 5)
    .map((c) => c.recommendation!);

  return {
    url: data.url,
    timestamp: new Date().toISOString(),
    total,
    grade: getGrade(total),
    breakdown,
    topRecommendations,
  };
}

// ─── Formatters ──────────────────────────────────────────────

function bar(s: number, max: number): string {
  const filled = Math.round((s / max) * 12);
  return "█".repeat(filled) + "░".repeat(12 - filled);
}

function wrapText(text: string, w: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    if (cur.length + word.length + 1 > w) {
      lines.push(cur);
      cur = "   " + word;
    } else {
      cur = cur ? cur + " " + word : word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function formatReport(report: ReadinessReport): string {
  const W = 52;
  const ln = "─".repeat(W);
  const b = report.breakdown;

  let out = `\n  ┌${ln}┐\n`;
  out += `  │  Agent Readiness Report${" ".repeat(W - 26)}│\n`;

  const host = (() => { try { return new URL(report.url).hostname; } catch { return report.url; } })();
  out += `  │  ${host.padEnd(W - 2)}│\n`;
  out += `  ├${ln}┤\n`;

  const dims: [string, DimensionScore][] = [
    ["Discovery ", b.discovery],
    ["Structure ", b.structure],
    ["Actions   ", b.actions],
    ["Policies  ", b.policies],
  ];

  for (const [name, dim] of dims) {
    out += `  │  ${name}  ${bar(dim.score, dim.max)}  ${String(dim.score).padStart(2)}/${dim.max}${" ".repeat(W - 34)}│\n`;
  }

  out += `  ├${ln}┤\n`;
  out += `  │  TOTAL SCORE          ${String(report.total).padStart(3)}/100   Grade: ${report.grade}${" ".repeat(W - 41)}│\n`;

  if (report.topRecommendations.length > 0) {
    out += `  ├${ln}┤\n`;
    out += `  │  Top recommendations:${" ".repeat(W - 23)}│\n`;
    for (let i = 0; i < report.topRecommendations.length; i++) {
      const lines = wrapText(`${i + 1}. ${report.topRecommendations[i]!}`, W - 4);
      for (const line of lines) {
        out += `  │  ${line.padEnd(W - 2)}│\n`;
      }
    }
  }

  out += `  └${ln}┘`;
  return out;
}

function formatDetailedReport(report: ReadinessReport): string {
  let out = formatReport(report);
  out += "\n\n  Detailed Checks:\n";

  const sections: [string, DimensionScore][] = [
    ["DISCOVERY", report.breakdown.discovery],
    ["STRUCTURE", report.breakdown.structure],
    ["ACTIONS", report.breakdown.actions],
    ["POLICIES", report.breakdown.policies],
  ];

  for (const [name, dim] of sections) {
    out += `\n  ── ${name} (${dim.score}/${dim.max}) ──\n`;
    for (const check of dim.checks) {
      const icon = check.passed ? "✓" : "✗";
      const pts = `${check.points}/${check.maxPoints}`;
      out += `    ${icon} ${check.name.padEnd(25)} ${pts.padStart(5)}  ${check.detail}\n`;
    }
  }

  return out;
}

function formatComparison(reports: ReadinessReport[]): string {
  const sorted = [...reports].sort((a, b) => b.total - a.total);

  let out = "\n  ┌────────────────────────────────────────────────────────────┐\n";
  out += "  │  Agent Readiness Comparison                               │\n";
  out += "  ├────────────────────────────────────────────────────────────┤\n";

  for (const r of sorted) {
    const host = (() => { try { return new URL(r.url).hostname; } catch { return r.url; } })();
    out += `  │  ${host.padEnd(32)} ${String(r.total).padStart(3)}/100  ${r.grade.padStart(2)}                │\n`;
  }

  out += "  ├────────────────────────────────────────────────────────────┤\n";
  out += "  │  " + "Site".padEnd(25) + "Disc".padStart(6) + "Struc".padStart(7) + "Actn".padStart(6) + "Polcy".padStart(7) + "Total".padStart(7) + "   │\n";
  out += "  │  " + "─".repeat(56) + "  │\n";

  for (const r of sorted) {
    const host = (() => { try { return new URL(r.url).hostname; } catch { return r.url; } })();
    out += "  │  " +
      host.substring(0, 24).padEnd(25) +
      `${r.breakdown.discovery.score}`.padStart(4) +
      `${r.breakdown.structure.score}`.padStart(7) +
      `${r.breakdown.actions.score}`.padStart(6) +
      `${r.breakdown.policies.score}`.padStart(7) +
      `${r.total}`.padStart(7) +
      "   │\n";
  }

  out += "  └────────────────────────────────────────────────────────────┘";
  return out;
}

// ─── CLI ─────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
  AgentWeb Readiness Scorer v1.0

  Score any website on agent readiness (0-100).

  Usage:
    tsx run-scorer.ts <url> [options]

  Options:
    --json       Output raw JSON
    --detailed   Show all individual checks
    --compare    Side-by-side comparison of multiple sites
    --output F   Save report to file F
    --help       Show this help

  Examples:
    tsx run-scorer.ts https://shopify.com
    tsx run-scorer.ts https://amazon.com https://shopify.com --compare
    tsx run-scorer.ts https://mysite.com --json --output report.json
`);
    return;
  }

  const jsonOutput = args.includes("--json");
  const detailed = args.includes("--detailed");
  const compare = args.includes("--compare");
  const outputIdx = args.indexOf("--output");
  const outputFile = outputIdx !== -1 ? args[outputIdx + 1] : undefined;

  const urls = args.filter(
    (a) => !a.startsWith("--") && (a.startsWith("http") || a.includes("."))
  );

  if (urls.length === 0) {
    console.error("  Error: No URL provided.");
    process.exit(1);
  }

  const reports: ReadinessReport[] = [];

  for (const url of urls) {
    process.stdout.write(`  Scanning ${url}...`);
    try {
      const data = await crawl(url);
      const report = score(data);
      reports.push(report);
      process.stdout.write(` ${report.total}/100 (${report.grade})\n`);
    } catch (err) {
      process.stdout.write(` ERROR\n`);
      console.error(`  ${err}`);
    }
  }

  if (reports.length === 0) {
    console.error("  No sites could be scored.");
    process.exit(1);
  }

  // Output
  if (jsonOutput) {
    const json = JSON.stringify(compare ? reports : reports[0], null, 2);
    if (outputFile) {
      const fs = await import("fs");
      fs.writeFileSync(outputFile, json);
      console.log(`\n  Report saved to ${outputFile}`);
    } else {
      console.log(json);
    }
    return;
  }

  if (compare && reports.length > 1) {
    console.log(formatComparison(reports));
  } else {
    for (const report of reports) {
      console.log(detailed ? formatDetailedReport(report) : formatReport(report));
    }
  }

  if (outputFile) {
    const fs = await import("fs");
    fs.writeFileSync(outputFile, JSON.stringify(compare ? reports : reports[0], null, 2));
    console.log(`\n  Full report saved to ${outputFile}`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
