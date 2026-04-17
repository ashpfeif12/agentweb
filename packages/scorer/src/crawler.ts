/**
 * Site Crawler
 *
 * Gathers data about a website for the readiness scorer.
 * Checks for agent.json, llms.txt, robots.txt, sitemap,
 * Schema.org markup, API endpoints, and more.
 */

import type { SiteData } from "./scorer";

export interface CrawlOptions {
  timeout?: number;
  userAgent?: string;
  followRedirects?: boolean;
}

const DEFAULT_OPTIONS: Required<CrawlOptions> = {
  timeout: 10000,
  userAgent: "AgentWeb-Scorer/1.0 (+https://agentweb.dev)",
  followRedirects: true,
};

export async function crawl(
  url: string,
  options: CrawlOptions = {}
): Promise<SiteData> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const base = normalizeUrl(url);

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

  // Run checks in parallel for speed
  const results = await Promise.allSettled([
    checkAgentJson(base, opts, data),
    checkLlmsTxt(base, opts, data),
    checkRobotsTxt(base, opts, data),
    checkSitemap(base, opts, data),
    checkMainPage(base, opts, data),
    checkCommonApiPaths(base, opts, data),
  ]);

  // Log any failures for debugging
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      const checks = [
        "agent.json",
        "llms.txt",
        "robots.txt",
        "sitemap",
        "main page",
        "API paths",
      ];
      console.error(`  ⚠ ${checks[i]} check failed: ${r.reason}`);
    }
  });

  // Derive MCP endpoint from agent.json if present
  if (data.agentJson?.endpoints) {
    const endpoints = data.agentJson.endpoints as Record<string, string>;
    if (endpoints.mcp) data.hasMcpEndpoint = true;
    if (endpoints.rest) data.hasRestApi = true;
    if (endpoints.graphql) data.hasGraphQL = true;
  }

  return data;
}

// ─── Individual Checks ───────────────────────────────────────

async function checkAgentJson(
  base: string,
  opts: Required<CrawlOptions>,
  data: SiteData
): Promise<void> {
  try {
    const res = await fetchWithTimeout(`${base}/agent.json`, opts);
    if (res.ok) {
      const text = await res.text();
      try {
        data.agentJson = JSON.parse(text);
        data.hasAgentJson = true;
      } catch {
        // Invalid JSON at agent.json path
        data.hasAgentJson = false;
      }
    }
  } catch {
    data.hasAgentJson = false;
  }
}

async function checkLlmsTxt(
  base: string,
  opts: Required<CrawlOptions>,
  data: SiteData
): Promise<void> {
  try {
    const res = await fetchWithTimeout(`${base}/llms.txt`, opts);
    data.hasLlmsTxt = res.ok;
  } catch {
    data.hasLlmsTxt = false;
  }
}

async function checkRobotsTxt(
  base: string,
  opts: Required<CrawlOptions>,
  data: SiteData
): Promise<void> {
  try {
    const res = await fetchWithTimeout(`${base}/robots.txt`, opts);
    data.hasRobotsTxt = res.ok;
  } catch {
    data.hasRobotsTxt = false;
  }
}

async function checkSitemap(
  base: string,
  opts: Required<CrawlOptions>,
  data: SiteData
): Promise<void> {
  try {
    const res = await fetchWithTimeout(`${base}/sitemap.xml`, opts);
    data.hasSitemap = res.ok;
  } catch {
    data.hasSitemap = false;
  }
}

async function checkMainPage(
  base: string,
  opts: Required<CrawlOptions>,
  data: SiteData
): Promise<void> {
  const start = Date.now();
  try {
    const res = await fetchWithTimeout(base, opts);
    data.responseTimeMs = Date.now() - start;

    // Check CORS
    data.corsEnabled = res.headers.has("access-control-allow-origin");

    // Check rate limit headers
    data.hasRateLimit =
      res.headers.has("x-ratelimit-limit") ||
      res.headers.has("ratelimit-limit") ||
      res.headers.has("retry-after");

    if (res.ok) {
      const html = await res.text();
      analyzeHtml(html, data);
    }
  } catch {
    data.responseTimeMs = Date.now() - start;
  }
}

async function checkCommonApiPaths(
  base: string,
  opts: Required<CrawlOptions>,
  data: SiteData
): Promise<void> {
  // Check common OpenAPI spec locations
  const openApiPaths = [
    "/openapi.json",
    "/openapi.yaml",
    "/swagger.json",
    "/api-docs",
    "/docs/api",
  ];

  for (const path of openApiPaths) {
    try {
      const res = await fetchWithTimeout(`${base}${path}`, {
        ...opts,
        timeout: 5000,
      });
      if (res.ok) {
        data.hasOpenApi = true;
        data.hasRestApi = true;
        break;
      }
    } catch {
      // Continue checking
    }
  }

  // Check common GraphQL paths
  const graphqlPaths = ["/graphql", "/api/graphql"];
  for (const path of graphqlPaths) {
    try {
      const res = await fetchWithTimeout(`${base}${path}`, {
        ...opts,
        timeout: 5000,
      });
      if (res.ok || res.status === 400) {
        // GraphQL often returns 400 for GET without query
        data.hasGraphQL = true;
        break;
      }
    } catch {
      // Continue
    }
  }
}

// ─── HTML Analysis ───────────────────────────────────────────

function analyzeHtml(html: string, data: SiteData): void {
  // Schema.org detection (JSON-LD)
  const jsonLdMatches = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  if (jsonLdMatches) {
    data.hasSchemaOrg = true;
    data.hasStructuredData = true;
    for (const match of jsonLdMatches) {
      const content = match.replace(
        /<script[^>]*>|<\/script>/gi,
        ""
      );
      try {
        const parsed = JSON.parse(content);
        const type = parsed["@type"];
        if (type) {
          const types = Array.isArray(type) ? type : [type];
          data.schemaOrgTypes.push(...types);
        }
      } catch {
        // Invalid JSON-LD
      }
    }
  }

  // Also check for microdata and RDFa
  if (
    html.includes('itemscope') ||
    html.includes('itemtype="http://schema.org') ||
    html.includes('vocab="http://schema.org')
  ) {
    data.hasSchemaOrg = true;
    data.hasStructuredData = true;
  }

  // Meta description
  const metaMatch = html.match(
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
  );
  data.metaDescription = metaMatch ? metaMatch[1] ?? null : null;

  // Semantic HTML
  const semanticElements = [
    "<article",
    "<section",
    "<nav",
    "<main",
    "<aside",
    "<header",
    "<footer",
  ];
  const semanticCount = semanticElements.filter((el) =>
    html.includes(el)
  ).length;
  data.semanticHtml = semanticCount >= 3;

  // Heading structure
  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  const h2Count = (html.match(/<h2[\s>]/gi) || []).length;
  data.headingStructure = h1Count === 1 && h2Count > 0;

  // Terms and Privacy
  const lowerHtml = html.toLowerCase();
  data.hasTermsOfService =
    lowerHtml.includes("terms of service") ||
    lowerHtml.includes("terms-of-service") ||
    lowerHtml.includes("terms of use") ||
    lowerHtml.includes("/tos") ||
    lowerHtml.includes("/terms");

  data.hasPrivacyPolicy =
    lowerHtml.includes("privacy policy") ||
    lowerHtml.includes("privacy-policy") ||
    lowerHtml.includes("/privacy");

  data.hasContactInfo =
    lowerHtml.includes("contact us") ||
    lowerHtml.includes("contact-us") ||
    lowerHtml.includes("/contact") ||
    lowerHtml.includes("mailto:");
}

// ─── Utilities ───────────────────────────────────────────────

function normalizeUrl(url: string): string {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  // Remove trailing slash
  return url.replace(/\/+$/, "");
}

async function fetchWithTimeout(
  url: string,
  opts: Required<CrawlOptions>
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeout);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": opts.userAgent },
      redirect: opts.followRedirects ? "follow" : "manual",
    });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}
