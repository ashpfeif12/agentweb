/**
 * Agent Readiness Scorer
 *
 * Scores a website on agent-readiness (0-100) across four dimensions:
 * - Discovery (0-25): Can agents find and understand what you offer?
 * - Structure (0-25): Is your content semantically structured?
 * - Actions (0-25): Can agents do things on your site?
 * - Policies (0-25): Are rules and boundaries clear?
 *
 * Each dimension produces specific, actionable recommendations.
 */

// ─── Score Types ─────────────────────────────────────────────

export interface ScoreBreakdown {
  discovery: DimensionScore;
  structure: DimensionScore;
  actions: DimensionScore;
  policies: DimensionScore;
}

export interface DimensionScore {
  score: number;
  max: number;
  checks: Check[];
}

export interface Check {
  name: string;
  passed: boolean;
  points: number;
  maxPoints: number;
  detail: string;
  recommendation?: string;
}

export interface ReadinessReport {
  url: string;
  timestamp: string;
  total: number;
  grade: string;
  breakdown: ScoreBreakdown;
  topRecommendations: string[];
}

// ─── Site Data (gathered by crawler) ─────────────────────────

export interface SiteData {
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

// ─── Scorer ──────────────────────────────────────────────────

export function score(data: SiteData): ReadinessReport {
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

  const grade = getGrade(total);

  const topRecommendations = getTopRecommendations(breakdown);

  return {
    url: data.url,
    timestamp: new Date().toISOString(),
    total,
    grade,
    breakdown,
    topRecommendations,
  };
}

// ─── Discovery Dimension (0-25) ──────────────────────────────

function scoreDiscovery(data: SiteData): DimensionScore {
  const checks: Check[] = [];

  // agent.json present (10 points - heavily weighted)
  checks.push({
    name: "agent.json manifest",
    passed: data.hasAgentJson,
    points: data.hasAgentJson ? 10 : 0,
    maxPoints: 10,
    detail: data.hasAgentJson
      ? "Found agent.json at domain root"
      : "No agent.json found",
    recommendation: data.hasAgentJson
      ? undefined
      : "Create an agent.json file at your domain root describing your capabilities",
  });

  // agent.json has description (3 points)
  const hasDescription =
    data.agentJson &&
    typeof data.agentJson.description === "string" &&
    (data.agentJson.description as string).length >= 20;
  checks.push({
    name: "Service description",
    passed: !!hasDescription,
    points: hasDescription ? 3 : 0,
    maxPoints: 3,
    detail: hasDescription
      ? "Good description for agent decision-making"
      : "Missing or too-short service description",
    recommendation: hasDescription
      ? undefined
      : "Add a 50-200 character description of what your service does",
  });

  // agent.json has capabilities (4 points)
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
    recommendation: hasCaps
      ? undefined
      : "List what agents can do with your service in the capabilities array",
  });

  // llms.txt present (3 points)
  checks.push({
    name: "llms.txt",
    passed: data.hasLlmsTxt,
    points: data.hasLlmsTxt ? 3 : 0,
    maxPoints: 3,
    detail: data.hasLlmsTxt
      ? "Found llms.txt for LLM context"
      : "No llms.txt found",
    recommendation: data.hasLlmsTxt
      ? undefined
      : "Add an llms.txt file with context for LLM consumption",
  });

  // robots.txt + sitemap (2 + 3 points)
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
    recommendation: data.hasSitemap
      ? undefined
      : "Add a sitemap.xml for agent crawlability",
  });

  return {
    score: checks.reduce((sum, c) => sum + c.points, 0),
    max: 25,
    checks,
  };
}

// ─── Structure Dimension (0-25) ──────────────────────────────

function scoreStructure(data: SiteData): DimensionScore {
  const checks: Check[] = [];

  // Schema.org markup (8 points)
  checks.push({
    name: "Schema.org markup",
    passed: data.hasSchemaOrg,
    points: data.hasSchemaOrg ? 8 : 0,
    maxPoints: 8,
    detail: data.hasSchemaOrg
      ? `Schema.org types found: ${data.schemaOrgTypes.join(", ")}`
      : "No Schema.org structured data",
    recommendation: data.hasSchemaOrg
      ? undefined
      : "Add Schema.org markup (JSON-LD) to your pages — this is the foundation agents use to understand your content",
  });

  // Semantic HTML (4 points)
  checks.push({
    name: "Semantic HTML",
    passed: data.semanticHtml,
    points: data.semanticHtml ? 4 : 0,
    maxPoints: 4,
    detail: data.semanticHtml
      ? "Uses semantic HTML elements"
      : "Limited semantic HTML structure",
    recommendation: data.semanticHtml
      ? undefined
      : "Use <article>, <nav>, <section>, <main> elements for better agent parsing",
  });

  // Heading structure (3 points)
  checks.push({
    name: "Heading hierarchy",
    passed: data.headingStructure,
    points: data.headingStructure ? 3 : 0,
    maxPoints: 3,
    detail: data.headingStructure
      ? "Proper heading hierarchy (h1 → h2 → h3)"
      : "Heading hierarchy issues",
  });

  // Meta description (2 points)
  checks.push({
    name: "Meta description",
    passed: !!data.metaDescription,
    points: data.metaDescription ? 2 : 0,
    maxPoints: 2,
    detail: data.metaDescription ? "Meta description present" : "No meta description",
  });

  // Data schemas in agent.json (5 points)
  const hasSchemas =
    data.agentJson &&
    Array.isArray(data.agentJson.data_schemas) &&
    (data.agentJson.data_schemas as unknown[]).length > 0;
  checks.push({
    name: "Data schemas declared",
    passed: !!hasSchemas,
    points: hasSchemas ? 5 : 0,
    maxPoints: 5,
    detail: hasSchemas
      ? "Structured data schemas defined in agent.json"
      : "No data schemas in agent.json",
    recommendation: hasSchemas
      ? undefined
      : "Define data_schemas in agent.json so agents know the shape of your data",
  });

  // HTTPS (3 points)
  checks.push({
    name: "HTTPS",
    passed: data.httpsEnabled,
    points: data.httpsEnabled ? 3 : 0,
    maxPoints: 3,
    detail: data.httpsEnabled ? "HTTPS enabled" : "No HTTPS — agents may refuse to connect",
  });

  return {
    score: checks.reduce((sum, c) => sum + c.points, 0),
    max: 25,
    checks,
  };
}

// ─── Actions Dimension (0-25) ────────────────────────────────

function scoreActions(data: SiteData): DimensionScore {
  const checks: Check[] = [];

  // Has any API (8 points)
  const hasApi = data.hasOpenApi || data.hasGraphQL || data.hasRestApi;
  checks.push({
    name: "API availability",
    passed: hasApi,
    points: hasApi ? 8 : 0,
    maxPoints: 8,
    detail: hasApi
      ? `API detected: ${[
          data.hasOpenApi && "OpenAPI",
          data.hasGraphQL && "GraphQL",
          data.hasRestApi && "REST",
        ]
          .filter(Boolean)
          .join(", ")}`
      : "No API detected",
    recommendation: hasApi
      ? undefined
      : "Expose an API (REST, GraphQL, or OpenAPI spec) so agents can interact programmatically",
  });

  // MCP endpoint (7 points)
  checks.push({
    name: "MCP endpoint",
    passed: data.hasMcpEndpoint,
    points: data.hasMcpEndpoint ? 7 : 0,
    maxPoints: 7,
    detail: data.hasMcpEndpoint
      ? "MCP server endpoint available"
      : "No MCP endpoint",
    recommendation: data.hasMcpEndpoint
      ? undefined
      : "Deploy an MCP server — run `npx agentweb generate` to auto-generate one from your API",
  });

  // Actions defined in agent.json (6 points)
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
      ? `${(data.agentJson!.actions as unknown[]).length} actions defined with schemas`
      : "No actions defined in agent.json",
    recommendation: hasActions
      ? undefined
      : "Define actions in agent.json with input_schema and output_schema",
  });

  // CORS enabled (2 points)
  checks.push({
    name: "CORS headers",
    passed: data.corsEnabled,
    points: data.corsEnabled ? 2 : 0,
    maxPoints: 2,
    detail: data.corsEnabled ? "CORS enabled" : "CORS not detected",
  });

  // Response time (2 points)
  const fastResponse = data.responseTimeMs < 500;
  checks.push({
    name: "Response time",
    passed: fastResponse,
    points: fastResponse ? 2 : 0,
    maxPoints: 2,
    detail: `Response time: ${data.responseTimeMs}ms${fastResponse ? "" : " (>500ms is slow for agents)"}`,
    recommendation: fastResponse
      ? undefined
      : "Optimize response time — agents expect sub-500ms responses",
  });

  return {
    score: checks.reduce((sum, c) => sum + c.points, 0),
    max: 25,
    checks,
  };
}

// ─── Policies Dimension (0-25) ───────────────────────────────

function scorePolicies(data: SiteData): DimensionScore {
  const checks: Check[] = [];

  // Rate limiting (5 points)
  const hasRatePolicy =
    data.agentJson &&
    data.agentJson.policies &&
    typeof (data.agentJson.policies as Record<string, unknown>).rate_limit === "string";
  checks.push({
    name: "Rate limit policy",
    passed: !!(data.hasRateLimit || hasRatePolicy),
    points: data.hasRateLimit || hasRatePolicy ? 5 : 0,
    maxPoints: 5,
    detail:
      data.hasRateLimit || hasRatePolicy
        ? "Rate limiting configured"
        : "No rate limit policy detected",
    recommendation:
      data.hasRateLimit || hasRatePolicy
        ? undefined
        : "Define rate limits so agents know their boundaries",
  });

  // Authentication defined (5 points)
  const hasAuth = data.agentJson && data.agentJson.authentication;
  checks.push({
    name: "Authentication defined",
    passed: !!hasAuth,
    points: hasAuth ? 5 : 0,
    maxPoints: 5,
    detail: hasAuth
      ? "Authentication method defined"
      : "No authentication method specified",
    recommendation: hasAuth
      ? undefined
      : "Define how agents should authenticate — even { type: 'none' } is informative",
  });

  // Data handling policy (4 points)
  const hasDataPolicy =
    data.agentJson &&
    data.agentJson.policies &&
    typeof (data.agentJson.policies as Record<string, unknown>).data_handling === "string";
  checks.push({
    name: "Data handling policy",
    passed: !!hasDataPolicy,
    points: hasDataPolicy ? 4 : 0,
    maxPoints: 4,
    detail: hasDataPolicy
      ? "Data handling rules specified"
      : "No data handling policy",
    recommendation: hasDataPolicy
      ? undefined
      : "Specify how agent platforms should handle your interaction data",
  });

  // Brand voice (4 points)
  const hasBrandVoice = data.agentJson && data.agentJson.brand_voice;
  checks.push({
    name: "Brand voice guidelines",
    passed: !!hasBrandVoice,
    points: hasBrandVoice ? 4 : 0,
    maxPoints: 4,
    detail: hasBrandVoice
      ? "Brand voice guidelines defined"
      : "No brand voice guidelines",
    recommendation: hasBrandVoice
      ? undefined
      : "Add brand_voice to control how agents represent your brand in conversations",
  });

  // Human escalation (4 points)
  const hasEscalation = data.agentJson && data.agentJson.humans;
  checks.push({
    name: "Human escalation paths",
    passed: !!hasEscalation,
    points: hasEscalation ? 4 : 0,
    maxPoints: 4,
    detail: hasEscalation
      ? "Human escalation paths defined"
      : "No human escalation defined",
    recommendation: hasEscalation
      ? undefined
      : "Define when and how agent interactions should escalate to humans",
  });

  // Terms of Service / Privacy (3 points)
  checks.push({
    name: "Terms & Privacy",
    passed: data.hasTermsOfService && data.hasPrivacyPolicy,
    points: (data.hasTermsOfService ? 1.5 : 0) + (data.hasPrivacyPolicy ? 1.5 : 0),
    maxPoints: 3,
    detail: `ToS: ${data.hasTermsOfService ? "✓" : "✗"}, Privacy: ${data.hasPrivacyPolicy ? "✓" : "✗"}`,
  });

  return {
    score: Math.round(checks.reduce((sum, c) => sum + c.points, 0)),
    max: 25,
    checks,
  };
}

// ─── Grading ─────────────────────────────────────────────────

function getGrade(total: number): string {
  if (total >= 90) return "A+";
  if (total >= 80) return "A";
  if (total >= 70) return "B";
  if (total >= 60) return "C";
  if (total >= 50) return "D";
  return "F";
}

// ─── Recommendations ─────────────────────────────────────────

function getTopRecommendations(breakdown: ScoreBreakdown): string[] {
  const allChecks = [
    ...breakdown.discovery.checks,
    ...breakdown.structure.checks,
    ...breakdown.actions.checks,
    ...breakdown.policies.checks,
  ];

  return allChecks
    .filter((c) => !c.passed && c.recommendation)
    .sort((a, b) => b.maxPoints - a.maxPoints)
    .slice(0, 5)
    .map((c) => c.recommendation!);
}

// ─── CLI Formatter ───────────────────────────────────────────

export function formatReport(report: ReadinessReport): string {
  const bar = (score: number, max: number) => {
    const filled = Math.round((score / max) * 12);
    return "█".repeat(filled) + "░".repeat(12 - filled);
  };

  const width = 50;
  const line = "─".repeat(width);

  let output = `
┌${line}┐
│  Agent Readiness Report                          │
│  ${report.url.padEnd(width - 2)}│
├${line}┤
│  Discovery    ${bar(report.breakdown.discovery.score, 25)}  ${String(report.breakdown.discovery.score).padStart(2)}/${report.breakdown.discovery.max}       │
│  Structure    ${bar(report.breakdown.structure.score, 25)}  ${String(report.breakdown.structure.score).padStart(2)}/${report.breakdown.structure.max}       │
│  Actions      ${bar(report.breakdown.actions.score, 25)}  ${String(report.breakdown.actions.score).padStart(2)}/${report.breakdown.actions.max}       │
│  Policies     ${bar(report.breakdown.policies.score, 25)}  ${String(report.breakdown.policies.score).padStart(2)}/${report.breakdown.policies.max}       │
├${line}┤
│  TOTAL SCORE          ${String(report.total).padStart(3)}/100   Grade: ${report.grade}          │
├${line}┤`;

  if (report.topRecommendations.length > 0) {
    output += `\n│  Top recommendations:${" ".repeat(width - 22)}│`;
    report.topRecommendations.forEach((rec, i) => {
      const lines = wrapText(`${i + 1}. ${rec}`, width - 4);
      lines.forEach((l) => {
        output += `\n│  ${l.padEnd(width - 2)}│`;
      });
    });
  }

  output += `\n└${line}┘`;
  return output;
}

function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (current.length + word.length + 1 > maxWidth) {
      lines.push(current);
      current = "   " + word;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}
