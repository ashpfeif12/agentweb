/**
 * Agent Visibility Engine
 *
 * Measures and optimizes how AI agents discover, rank, and
 * recommend a brand. This is the core of Agent SEO.
 *
 * Traditional SEO: "Do you rank in Google's 10 blue links?"
 * Agent SEO: "Do agents recommend you when users ask?"
 */

export interface VisibilityScore {
  overall: number;  // 0-100
  dimensions: {
    discoverability: number;    // Can agents find you?
    dataQuality: number;        // Is your structured data complete?
    policyClarity: number;      // Are your rules machine-readable?
    brandConsistency: number;   // Is your brand voice defined?
    competitivePosition: number; // How do you compare to competitors?
  };
  recommendations: Recommendation[];
  competitors: CompetitorComparison[];
}

export interface Recommendation {
  priority: "high" | "medium" | "low";
  category: string;
  action: string;
  impact: string;
  effort: string;
}

export interface CompetitorComparison {
  name: string;
  url: string;
  score: number;
  advantages: string[];
  disadvantages: string[];
}

export interface QuerySimulation {
  query: string;
  platform: string;  // "claude", "gpt", "gemini", "siri"
  yourBrandMentioned: boolean;
  position: number | null;  // null = not mentioned
  competitorsMentioned: string[];
  recommendation: string;
}

export interface AgentQuery {
  query: string;
  timestamp: number;
  agentPlatform: string;
  brandMentioned: boolean;
  sentiment: "positive" | "neutral" | "negative";
  context: string;
}

// ─── Visibility Scorer ───────────────────────────────────────

export function scoreVisibility(siteData: SiteAnalysis): VisibilityScore {
  const discoverability = scoreDiscoverability(siteData);
  const dataQuality = scoreDataQuality(siteData);
  const policyClarity = scorePolicyClarity(siteData);
  const brandConsistency = scoreBrandConsistency(siteData);
  const competitivePosition = 50; // Needs competitor data

  const overall = Math.round(
    discoverability * 0.25 +
    dataQuality * 0.25 +
    policyClarity * 0.20 +
    brandConsistency * 0.15 +
    competitivePosition * 0.15
  );

  const recommendations = generateRecommendations(siteData, {
    discoverability, dataQuality, policyClarity, brandConsistency, competitivePosition,
  });

  return {
    overall,
    dimensions: { discoverability, dataQuality, policyClarity, brandConsistency, competitivePosition },
    recommendations,
    competitors: [],
  };
}

export interface SiteAnalysis {
  url: string;
  hasAgentJson: boolean;
  agentJsonComplete: number;  // 0-100 completeness
  hasLlmsTxt: boolean;
  hasMcpEndpoint: boolean;
  schemaOrgCoverage: number;  // 0-100
  schemaOrgTypes: string[];
  apiDocumented: boolean;
  policiesMachineReadable: boolean;
  brandVoiceDefined: boolean;
  escalationPathsDefined: boolean;
  responseTimeMs: number;
  contentFreshnessDays: number;
  structuredDataErrors: number;
}

function scoreDiscoverability(data: SiteAnalysis): number {
  let score = 0;
  if (data.hasAgentJson) score += 35;
  if (data.hasLlmsTxt) score += 15;
  if (data.hasMcpEndpoint) score += 25;
  if (data.apiDocumented) score += 15;
  if (data.responseTimeMs < 500) score += 10;
  return Math.min(100, score);
}

function scoreDataQuality(data: SiteAnalysis): number {
  let score = 0;
  score += data.schemaOrgCoverage * 0.4;
  score += data.agentJsonComplete * 0.3;
  if (data.structuredDataErrors === 0) score += 15;
  if (data.contentFreshnessDays < 30) score += 15;
  return Math.min(100, Math.round(score));
}

function scorePolicyClarity(data: SiteAnalysis): number {
  let score = 0;
  if (data.policiesMachineReadable) score += 40;
  if (data.escalationPathsDefined) score += 30;
  if (data.hasAgentJson) score += 30; // agent.json includes policies section
  return Math.min(100, score);
}

function scoreBrandConsistency(data: SiteAnalysis): number {
  let score = 0;
  if (data.brandVoiceDefined) score += 50;
  if (data.hasAgentJson && data.agentJsonComplete > 70) score += 30;
  if (data.hasMcpEndpoint) score += 20; // Consistent experience via MCP
  return Math.min(100, score);
}

function generateRecommendations(
  data: SiteAnalysis,
  scores: Record<string, number>
): Recommendation[] {
  const recs: Recommendation[] = [];

  if (!data.hasAgentJson) {
    recs.push({
      priority: "high",
      category: "Discoverability",
      action: "Create an agent.json manifest at your domain root",
      impact: "Agents will know what you offer and how to interact — this is the single highest-impact action",
      effort: "Run: npx agentweb init --industry your_industry",
    });
  }

  if (!data.hasMcpEndpoint) {
    recs.push({
      priority: "high",
      category: "Discoverability",
      action: "Deploy an MCP server endpoint",
      impact: "Agents can connect directly to your service instead of scraping your website",
      effort: "Run: npx agentweb generate --from your-openapi-spec",
    });
  }

  if (data.schemaOrgCoverage < 50) {
    recs.push({
      priority: "high",
      category: "Data Quality",
      action: "Add Schema.org JSON-LD markup to your key pages",
      impact: "Structured data is how agents understand your content — low coverage means agents guess",
      effort: "Add Product, Organization, or relevant schema types to your templates",
    });
  }

  if (!data.brandVoiceDefined) {
    recs.push({
      priority: "medium",
      category: "Brand Consistency",
      action: "Define brand voice guidelines in your agent.json",
      impact: "Without this, agents use their own judgment when representing your brand",
      effort: "Add brand_voice section with tone, prohibited topics, and preferred name",
    });
  }

  if (!data.policiesMachineReadable) {
    recs.push({
      priority: "medium",
      category: "Policy Clarity",
      action: "Make business policies machine-readable in agent.json",
      impact: "Agents can proactively share return policies, shipping costs before users ask",
      effort: "Add policies.business_policies section to your agent.json",
    });
  }

  if (!data.escalationPathsDefined) {
    recs.push({
      priority: "medium",
      category: "Policy Clarity",
      action: "Define human escalation paths",
      impact: "Agents will know when to hand off to humans and how to do it",
      effort: "Add humans section with triggers and support channels",
    });
  }

  if (!data.hasLlmsTxt) {
    recs.push({
      priority: "low",
      category: "Discoverability",
      action: "Create an llms.txt file",
      impact: "Provides LLMs with a curated overview of your content",
      effort: "Create a markdown file at /llms.txt with your key info",
    });
  }

  if (data.responseTimeMs >= 500) {
    recs.push({
      priority: "low",
      category: "Data Quality",
      action: "Improve response time (currently " + data.responseTimeMs + "ms)",
      impact: "Agents expect sub-500ms responses — slow sites may be deprioritized",
      effort: "Optimize server performance, add caching, use CDN",
    });
  }

  return recs.sort((a, b) => {
    const pri = { high: 0, medium: 1, low: 2 };
    return pri[a.priority] - pri[b.priority];
  });
}

// ─── Query Monitor ───────────────────────────────────────────

export class QueryMonitor {
  private queries: AgentQuery[] = [];
  private maxQueries = 10000;

  record(query: AgentQuery): void {
    this.queries.push(query);
    if (this.queries.length > this.maxQueries) {
      this.queries = this.queries.slice(-this.maxQueries);
    }
  }

  getQueryPatterns(sinceMs?: number): {
    totalQueries: number;
    mentionRate: number;
    topQueries: Array<{ query: string; count: number; mentioned: boolean }>;
    sentimentBreakdown: { positive: number; neutral: number; negative: number };
    platformBreakdown: Array<{ platform: string; count: number; mentionRate: number }>;
  } {
    const since = sinceMs || Date.now() - 86400000;
    const filtered = this.queries.filter(q => q.timestamp >= since);

    if (filtered.length === 0) {
      return {
        totalQueries: 0,
        mentionRate: 0,
        topQueries: [],
        sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
        platformBreakdown: [],
      };
    }

    const mentioned = filtered.filter(q => q.brandMentioned).length;

    // Top queries
    const qCounts = new Map<string, { count: number; mentioned: boolean }>();
    for (const q of filtered) {
      const key = q.query.toLowerCase().trim();
      const existing = qCounts.get(key);
      if (existing) {
        existing.count++;
        if (q.brandMentioned) existing.mentioned = true;
      } else {
        qCounts.set(key, { count: 1, mentioned: q.brandMentioned });
      }
    }

    // Sentiment
    const sentiment = {
      positive: filtered.filter(q => q.sentiment === "positive").length,
      neutral: filtered.filter(q => q.sentiment === "neutral").length,
      negative: filtered.filter(q => q.sentiment === "negative").length,
    };

    // Platform breakdown
    const platforms = new Map<string, { count: number; mentioned: number }>();
    for (const q of filtered) {
      const p = platforms.get(q.agentPlatform) || { count: 0, mentioned: 0 };
      p.count++;
      if (q.brandMentioned) p.mentioned++;
      platforms.set(q.agentPlatform, p);
    }

    return {
      totalQueries: filtered.length,
      mentionRate: Math.round((mentioned / filtered.length) * 100) / 100,
      topQueries: [...qCounts.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([query, data]) => ({ query, ...data })),
      sentimentBreakdown: sentiment,
      platformBreakdown: [...platforms.entries()]
        .map(([platform, data]) => ({
          platform,
          count: data.count,
          mentionRate: Math.round((data.mentioned / data.count) * 100) / 100,
        })),
    };
  }
}
