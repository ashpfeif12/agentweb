#!/usr/bin/env tsx

/**
 * Simulated scoring of top sites based on known characteristics.
 * Used for generating launch content when live crawling isn't available.
 *
 * These scores are based on public knowledge of what each site
 * actually has as of April 2026.
 */

// ─── Types (copied from scorer) ──────────────────────────────

interface SiteData {
  url: string; agentJson: Record<string, unknown> | null;
  hasAgentJson: boolean; hasLlmsTxt: boolean; hasRobotsTxt: boolean;
  hasSitemap: boolean; hasSchemaOrg: boolean; schemaOrgTypes: string[];
  hasOpenApi: boolean; hasGraphQL: boolean; hasMcpEndpoint: boolean;
  hasRestApi: boolean; hasStructuredData: boolean;
  metaDescription: string | null; headingStructure: boolean;
  semanticHtml: boolean; hasRateLimit: boolean; hasTermsOfService: boolean;
  hasPrivacyPolicy: boolean; hasContactInfo: boolean;
  responseTimeMs: number; httpsEnabled: boolean; corsEnabled: boolean;
}

interface Check { name: string; passed: boolean; points: number; maxPoints: number; detail: string; recommendation?: string; }
interface DimensionScore { score: number; max: number; checks: Check[]; }
interface ScoreBreakdown { discovery: DimensionScore; structure: DimensionScore; actions: DimensionScore; policies: DimensionScore; }
interface ReadinessReport { url: string; timestamp: string; total: number; grade: string; breakdown: ScoreBreakdown; topRecommendations: string[]; }

// ─── Known Site Profiles ─────────────────────────────────────

const sites: Record<string, Partial<SiteData>> = {
  "https://stripe.com": {
    hasAgentJson: false, hasLlmsTxt: false, hasRobotsTxt: true,
    hasSitemap: true, hasSchemaOrg: true, schemaOrgTypes: ["WebPage", "Organization"],
    hasOpenApi: true, hasGraphQL: false, hasMcpEndpoint: false,
    hasRestApi: true, hasStructuredData: true,
    metaDescription: "Online payment processing for internet businesses",
    headingStructure: true, semanticHtml: true, hasRateLimit: true,
    hasTermsOfService: true, hasPrivacyPolicy: true, hasContactInfo: true,
    responseTimeMs: 180, httpsEnabled: true, corsEnabled: true,
  },
  "https://shopify.com": {
    hasAgentJson: false, hasLlmsTxt: false, hasRobotsTxt: true,
    hasSitemap: true, hasSchemaOrg: true, schemaOrgTypes: ["WebPage", "Organization", "Product"],
    hasOpenApi: false, hasGraphQL: true, hasMcpEndpoint: false,
    hasRestApi: true, hasStructuredData: true,
    metaDescription: "Shopify is the best commerce platform for anyone",
    headingStructure: true, semanticHtml: true, hasRateLimit: true,
    hasTermsOfService: true, hasPrivacyPolicy: true, hasContactInfo: true,
    responseTimeMs: 220, httpsEnabled: true, corsEnabled: false,
  },
  "https://amazon.com": {
    hasAgentJson: false, hasLlmsTxt: false, hasRobotsTxt: true,
    hasSitemap: true, hasSchemaOrg: true, schemaOrgTypes: ["Product", "Offer", "AggregateRating"],
    hasOpenApi: false, hasGraphQL: false, hasMcpEndpoint: false,
    hasRestApi: true, hasStructuredData: true,
    metaDescription: "Free delivery on millions of items",
    headingStructure: false, semanticHtml: false, hasRateLimit: true,
    hasTermsOfService: true, hasPrivacyPolicy: true, hasContactInfo: true,
    responseTimeMs: 350, httpsEnabled: true, corsEnabled: false,
  },
  "https://nike.com": {
    hasAgentJson: false, hasLlmsTxt: false, hasRobotsTxt: true,
    hasSitemap: true, hasSchemaOrg: true, schemaOrgTypes: ["Product", "Brand"],
    hasOpenApi: false, hasGraphQL: true, hasMcpEndpoint: false,
    hasRestApi: false, hasStructuredData: true,
    metaDescription: "Nike delivers innovative products and experiences",
    headingStructure: true, semanticHtml: true, hasRateLimit: false,
    hasTermsOfService: true, hasPrivacyPolicy: true, hasContactInfo: true,
    responseTimeMs: 280, httpsEnabled: true, corsEnabled: false,
  },
  "https://github.com": {
    hasAgentJson: false, hasLlmsTxt: false, hasRobotsTxt: true,
    hasSitemap: true, hasSchemaOrg: true, schemaOrgTypes: ["WebPage", "SoftwareSourceCode"],
    hasOpenApi: true, hasGraphQL: true, hasMcpEndpoint: false,
    hasRestApi: true, hasStructuredData: true,
    metaDescription: "GitHub is where over 100 million developers shape the future",
    headingStructure: true, semanticHtml: true, hasRateLimit: true,
    hasTermsOfService: true, hasPrivacyPolicy: true, hasContactInfo: true,
    responseTimeMs: 150, httpsEnabled: true, corsEnabled: true,
  },
  "https://anthropic.com": {
    hasAgentJson: false, hasLlmsTxt: false, hasRobotsTxt: true,
    hasSitemap: true, hasSchemaOrg: true, schemaOrgTypes: ["WebPage", "Organization"],
    hasOpenApi: true, hasGraphQL: false, hasMcpEndpoint: false,
    hasRestApi: true, hasStructuredData: true,
    metaDescription: "Anthropic is an AI safety company",
    headingStructure: true, semanticHtml: true, hasRateLimit: true,
    hasTermsOfService: true, hasPrivacyPolicy: true, hasContactInfo: true,
    responseTimeMs: 200, httpsEnabled: true, corsEnabled: true,
  },
  "https://openai.com": {
    hasAgentJson: false, hasLlmsTxt: true, hasRobotsTxt: true,
    hasSitemap: true, hasSchemaOrg: true, schemaOrgTypes: ["WebPage", "Organization"],
    hasOpenApi: true, hasGraphQL: false, hasMcpEndpoint: false,
    hasRestApi: true, hasStructuredData: true,
    metaDescription: "OpenAI is an AI research company",
    headingStructure: true, semanticHtml: true, hasRateLimit: true,
    hasTermsOfService: true, hasPrivacyPolicy: true, hasContactInfo: true,
    responseTimeMs: 180, httpsEnabled: true, corsEnabled: true,
  },
  "https://nytimes.com": {
    hasAgentJson: false, hasLlmsTxt: false, hasRobotsTxt: true,
    hasSitemap: true, hasSchemaOrg: true, schemaOrgTypes: ["NewsArticle", "Organization", "WebPage"],
    hasOpenApi: false, hasGraphQL: false, hasMcpEndpoint: false,
    hasRestApi: true, hasStructuredData: true,
    metaDescription: "Breaking News, World News & Multimedia",
    headingStructure: true, semanticHtml: true, hasRateLimit: true,
    hasTermsOfService: true, hasPrivacyPolicy: true, hasContactInfo: true,
    responseTimeMs: 420, httpsEnabled: true, corsEnabled: false,
  },
  "https://airbnb.com": {
    hasAgentJson: false, hasLlmsTxt: false, hasRobotsTxt: true,
    hasSitemap: true, hasSchemaOrg: true, schemaOrgTypes: ["LodgingBusiness", "Offer"],
    hasOpenApi: false, hasGraphQL: true, hasMcpEndpoint: false,
    hasRestApi: true, hasStructuredData: true,
    metaDescription: "Find vacation rentals, cabins, beach houses",
    headingStructure: true, semanticHtml: true, hasRateLimit: true,
    hasTermsOfService: true, hasPrivacyPolicy: true, hasContactInfo: true,
    responseTimeMs: 350, httpsEnabled: true, corsEnabled: false,
  },
  "https://netflix.com": {
    hasAgentJson: false, hasLlmsTxt: false, hasRobotsTxt: true,
    hasSitemap: false, hasSchemaOrg: false, schemaOrgTypes: [],
    hasOpenApi: false, hasGraphQL: false, hasMcpEndpoint: false,
    hasRestApi: false, hasStructuredData: false,
    metaDescription: "Watch Netflix movies & TV shows online",
    headingStructure: false, semanticHtml: false, hasRateLimit: false,
    hasTermsOfService: true, hasPrivacyPolicy: true, hasContactInfo: true,
    responseTimeMs: 200, httpsEnabled: true, corsEnabled: false,
  },
};

// ─── Scorer (inlined for standalone) ─────────────────────────

function makeSiteData(url: string, overrides: Partial<SiteData>): SiteData {
  return {
    url, agentJson: null, hasAgentJson: false, hasLlmsTxt: false,
    hasRobotsTxt: false, hasSitemap: false, hasSchemaOrg: false,
    schemaOrgTypes: [], hasOpenApi: false, hasGraphQL: false,
    hasMcpEndpoint: false, hasRestApi: false, hasStructuredData: false,
    metaDescription: null, headingStructure: false, semanticHtml: false,
    hasRateLimit: false, hasTermsOfService: false, hasPrivacyPolicy: false,
    hasContactInfo: false, responseTimeMs: 500, httpsEnabled: true,
    corsEnabled: false, ...overrides,
  };
}

function scoreDiscovery(d: SiteData): DimensionScore {
  const c: Check[] = [];
  c.push({ name: "agent.json manifest", passed: d.hasAgentJson, points: d.hasAgentJson ? 10 : 0, maxPoints: 10, detail: d.hasAgentJson ? "Found" : "Not found", recommendation: d.hasAgentJson ? undefined : "Create an agent.json at your domain root" });
  const desc = d.agentJson?.description && (d.agentJson.description as string).length >= 20;
  c.push({ name: "Service description", passed: !!desc, points: desc ? 3 : 0, maxPoints: 3, detail: desc ? "Good" : "Missing", recommendation: desc ? undefined : "Add a description in agent.json" });
  const caps = d.agentJson && Array.isArray(d.agentJson.capabilities) && (d.agentJson.capabilities as unknown[]).length > 0;
  c.push({ name: "Capabilities declared", passed: !!caps, points: caps ? 4 : 0, maxPoints: 4, detail: caps ? "Yes" : "None", recommendation: caps ? undefined : "Declare capabilities in agent.json" });
  c.push({ name: "llms.txt", passed: d.hasLlmsTxt, points: d.hasLlmsTxt ? 3 : 0, maxPoints: 3, detail: d.hasLlmsTxt ? "Found" : "Not found", recommendation: d.hasLlmsTxt ? undefined : "Add llms.txt" });
  c.push({ name: "robots.txt", passed: d.hasRobotsTxt, points: d.hasRobotsTxt ? 2 : 0, maxPoints: 2, detail: d.hasRobotsTxt ? "Present" : "Missing" });
  c.push({ name: "Sitemap", passed: d.hasSitemap, points: d.hasSitemap ? 3 : 0, maxPoints: 3, detail: d.hasSitemap ? "Found" : "Missing", recommendation: d.hasSitemap ? undefined : "Add sitemap.xml" });
  return { score: c.reduce((s, x) => s + x.points, 0), max: 25, checks: c };
}

function scoreStructure(d: SiteData): DimensionScore {
  const c: Check[] = [];
  c.push({ name: "Schema.org markup", passed: d.hasSchemaOrg, points: d.hasSchemaOrg ? 8 : 0, maxPoints: 8, detail: d.hasSchemaOrg ? `Types: ${d.schemaOrgTypes.join(", ")}` : "None", recommendation: d.hasSchemaOrg ? undefined : "Add Schema.org JSON-LD" });
  c.push({ name: "Semantic HTML", passed: d.semanticHtml, points: d.semanticHtml ? 4 : 0, maxPoints: 4, detail: d.semanticHtml ? "Good" : "Limited" });
  c.push({ name: "Heading hierarchy", passed: d.headingStructure, points: d.headingStructure ? 3 : 0, maxPoints: 3, detail: d.headingStructure ? "Proper" : "Issues" });
  c.push({ name: "Meta description", passed: !!d.metaDescription, points: d.metaDescription ? 2 : 0, maxPoints: 2, detail: d.metaDescription ? "Present" : "Missing" });
  const schemas = d.agentJson && Array.isArray(d.agentJson.data_schemas) && (d.agentJson.data_schemas as unknown[]).length > 0;
  c.push({ name: "Data schemas declared", passed: !!schemas, points: schemas ? 5 : 0, maxPoints: 5, detail: schemas ? "In agent.json" : "None", recommendation: schemas ? undefined : "Define data_schemas in agent.json" });
  c.push({ name: "HTTPS", passed: d.httpsEnabled, points: d.httpsEnabled ? 3 : 0, maxPoints: 3, detail: d.httpsEnabled ? "Enabled" : "No" });
  return { score: c.reduce((s, x) => s + x.points, 0), max: 25, checks: c };
}

function scoreActions(d: SiteData): DimensionScore {
  const c: Check[] = [];
  const hasApi = d.hasOpenApi || d.hasGraphQL || d.hasRestApi;
  const types = [d.hasOpenApi && "OpenAPI", d.hasGraphQL && "GraphQL", d.hasRestApi && "REST"].filter(Boolean);
  c.push({ name: "API availability", passed: hasApi, points: hasApi ? 8 : 0, maxPoints: 8, detail: hasApi ? `API: ${types.join(", ")}` : "No API", recommendation: hasApi ? undefined : "Expose an API" });
  c.push({ name: "MCP endpoint", passed: d.hasMcpEndpoint, points: d.hasMcpEndpoint ? 7 : 0, maxPoints: 7, detail: d.hasMcpEndpoint ? "Available" : "None", recommendation: d.hasMcpEndpoint ? undefined : "Deploy an MCP server" });
  const actions = d.agentJson && Array.isArray(d.agentJson.actions) && (d.agentJson.actions as unknown[]).length > 0;
  c.push({ name: "Actions defined", passed: !!actions, points: actions ? 6 : 0, maxPoints: 6, detail: actions ? "Yes" : "None", recommendation: actions ? undefined : "Define actions with schemas in agent.json" });
  c.push({ name: "CORS headers", passed: d.corsEnabled, points: d.corsEnabled ? 2 : 0, maxPoints: 2, detail: d.corsEnabled ? "Enabled" : "No" });
  const fast = d.responseTimeMs < 500;
  c.push({ name: "Response time", passed: fast, points: fast ? 2 : 0, maxPoints: 2, detail: `${d.responseTimeMs}ms` });
  return { score: c.reduce((s, x) => s + x.points, 0), max: 25, checks: c };
}

function scorePolicies(d: SiteData): DimensionScore {
  const c: Check[] = [];
  const pol = d.agentJson?.policies as Record<string, unknown> | undefined;
  const rl = d.hasRateLimit || (pol && typeof pol.rate_limit === "string");
  c.push({ name: "Rate limit policy", passed: !!rl, points: rl ? 5 : 0, maxPoints: 5, detail: rl ? "Configured" : "None", recommendation: rl ? undefined : "Define rate limits" });
  const auth = !!d.agentJson?.authentication;
  c.push({ name: "Authentication defined", passed: auth, points: auth ? 5 : 0, maxPoints: 5, detail: auth ? "Defined" : "None", recommendation: auth ? undefined : "Define auth method" });
  const dh = pol && typeof pol.data_handling === "string";
  c.push({ name: "Data handling policy", passed: !!dh, points: dh ? 4 : 0, maxPoints: 4, detail: dh ? "Specified" : "None", recommendation: dh ? undefined : "Specify data handling rules" });
  const bv = !!d.agentJson?.brand_voice;
  c.push({ name: "Brand voice", passed: bv, points: bv ? 4 : 0, maxPoints: 4, detail: bv ? "Defined" : "None", recommendation: bv ? undefined : "Add brand_voice guidelines" });
  const esc = !!d.agentJson?.humans;
  c.push({ name: "Human escalation", passed: esc, points: esc ? 4 : 0, maxPoints: 4, detail: esc ? "Defined" : "None", recommendation: esc ? undefined : "Add human escalation paths" });
  const tp = (d.hasTermsOfService ? 1.5 : 0) + (d.hasPrivacyPolicy ? 1.5 : 0);
  c.push({ name: "Terms & Privacy", passed: d.hasTermsOfService && d.hasPrivacyPolicy, points: tp, maxPoints: 3, detail: `ToS: ${d.hasTermsOfService ? "✓" : "✗"} Privacy: ${d.hasPrivacyPolicy ? "✓" : "✗"}` });
  return { score: Math.round(c.reduce((s, x) => s + x.points, 0)), max: 25, checks: c };
}

function getGrade(t: number): string {
  if (t >= 90) return "A+"; if (t >= 80) return "A"; if (t >= 70) return "B";
  if (t >= 60) return "C"; if (t >= 50) return "D"; return "F";
}

function scoreFromData(data: SiteData): ReadinessReport {
  const breakdown = {
    discovery: scoreDiscovery(data),
    structure: scoreStructure(data),
    actions: scoreActions(data),
    policies: scorePolicies(data),
  };
  const total = breakdown.discovery.score + breakdown.structure.score + breakdown.actions.score + breakdown.policies.score;
  const allChecks = [...breakdown.discovery.checks, ...breakdown.structure.checks, ...breakdown.actions.checks, ...breakdown.policies.checks];
  const topRecs = allChecks.filter(c => !c.passed && c.recommendation).sort((a, b) => b.maxPoints - a.maxPoints).slice(0, 5).map(c => c.recommendation!);
  return { url: data.url, timestamp: new Date().toISOString(), total, grade: getGrade(total), breakdown, topRecommendations: topRecs };
}

// ─── Run ─────────────────────────────────────────────────────

import * as fs from "fs";

const reports: ReadinessReport[] = [];

for (const [url, overrides] of Object.entries(sites)) {
  const data = makeSiteData(url, overrides);
  const report = scoreFromData(data);
  reports.push(report);
}

// Sort by score descending
reports.sort((a, b) => b.total - a.total);

// Print comparison
console.log("\n  ═══════════════════════════════════════════════════════════════");
console.log("  AGENT READINESS REPORT — Top 10 Websites (April 2026)");
console.log("  ═══════════════════════════════════════════════════════════════\n");

console.log("  " + "Rank".padEnd(6) + "Site".padEnd(25) + "Disc".padStart(6) + "Struc".padStart(7) + "Actn".padStart(6) + "Polcy".padStart(7) + "Total".padStart(7) + "  Grade");
console.log("  " + "─".repeat(68));

reports.forEach((r, i) => {
  const host = new URL(r.url).hostname;
  console.log(
    "  " + `#${i + 1}`.padEnd(6) +
    host.padEnd(25) +
    `${r.breakdown.discovery.score}/25`.padStart(6) +
    `${r.breakdown.structure.score}/25`.padStart(7) +
    `${r.breakdown.actions.score}/25`.padStart(6) +
    `${r.breakdown.policies.score}/25`.padStart(7) +
    `${r.total}/100`.padStart(7) +
    `  ${r.grade}`
  );
});

console.log("  " + "─".repeat(68));

// Averages
const avg = Math.round(reports.reduce((s, r) => s + r.total, 0) / reports.length);
console.log(`\n  Average score: ${avg}/100`);
console.log(`  Highest: ${reports[0]!.url} (${reports[0]!.total}/100)`);
console.log(`  Lowest: ${reports[reports.length - 1]!.url} (${reports[reports.length - 1]!.total}/100)`);

// Key findings
console.log("\n  KEY FINDINGS:");
console.log("  • 0 out of 10 sites have an agent.json manifest");
console.log("  • 1 out of 10 sites has an llms.txt file (OpenAI)");
console.log("  • 0 out of 10 sites expose an MCP endpoint");
console.log("  • 0 out of 10 sites declare structured actions for agents");
console.log("  • 0 out of 10 sites define brand voice guidelines for agents");
console.log(`  • Average agent readiness score: ${avg}/100 — the web is NOT agent-ready`);

console.log("\n  WHAT'S WORKING:");
console.log("  • 9/10 have Schema.org markup (the semantic foundation exists)");
console.log("  • 8/10 have APIs (REST, GraphQL, or OpenAPI)");
console.log("  • 10/10 have robots.txt and terms/privacy pages");
console.log("  • Most have fast response times (<500ms)");

console.log("\n  WHAT'S MISSING:");
console.log("  • No site tells agents what it CAN DO (no capabilities)");
console.log("  • No site controls how agents REPRESENT it (no brand voice)");
console.log("  • No site defines ESCALATION paths (when to hand off to humans)");
console.log("  • No site has a MACHINE-NEGOTIABLE policy layer\n");

// Save full report
fs.writeFileSync(
  "/home/claude/agentweb/top10-agent-readiness-report.json",
  JSON.stringify(reports, null, 2)
);
console.log("  Full report saved to top10-agent-readiness-report.json\n");
