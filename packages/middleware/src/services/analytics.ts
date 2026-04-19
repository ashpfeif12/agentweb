/**
 * Agent Analytics Service
 *
 * Tracks agent interactions, query patterns, and conversion metrics.
 * This is the data layer that powers the analytics dashboard
 * and eventually feeds into Agent SEO.
 */

export interface AgentEvent {
  timestamp: number;
  agentId: string;
  tool: string;
  query?: string;
  originUrl: string;
  responseTimeMs: number;
  cached: boolean;
  escalated: boolean;
  brandViolations: number;
}

export interface AnalyticsSummary {
  totalRequests: number;
  uniqueAgents: number;
  avgResponseTimeMs: number;
  cacheHitRate: number;
  topTools: Array<{ tool: string; count: number }>;
  topQueries: Array<{ query: string; count: number }>;
  escalationRate: number;
  brandViolationCount: number;
  requestsPerMinute: number;
  period: { start: number; end: number };
}

export class Analytics {
  private events: AgentEvent[] = [];
  private maxEvents = 10000;

  track(event: AgentEvent): void {
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  summary(sinceMs?: number): AnalyticsSummary {
    const since = sinceMs || Date.now() - 3600000; // last hour default
    const filtered = this.events.filter(e => e.timestamp >= since);

    if (filtered.length === 0) {
      return {
        totalRequests: 0,
        uniqueAgents: 0,
        avgResponseTimeMs: 0,
        cacheHitRate: 0,
        topTools: [],
        topQueries: [],
        escalationRate: 0,
        brandViolationCount: 0,
        requestsPerMinute: 0,
        period: { start: since, end: Date.now() },
      };
    }

    const agents = new Set(filtered.map(e => e.agentId));
    const avgTime = filtered.reduce((s, e) => s + e.responseTimeMs, 0) / filtered.length;
    const cached = filtered.filter(e => e.cached).length;
    const escalated = filtered.filter(e => e.escalated).length;
    const violations = filtered.reduce((s, e) => s + e.brandViolations, 0);

    // Top tools
    const toolCounts = new Map<string, number>();
    for (const e of filtered) {
      toolCounts.set(e.tool, (toolCounts.get(e.tool) || 0) + 1);
    }
    const topTools = [...toolCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tool, count]) => ({ tool, count }));

    // Top queries
    const queryCounts = new Map<string, number>();
    for (const e of filtered) {
      if (e.query) {
        queryCounts.set(e.query, (queryCounts.get(e.query) || 0) + 1);
      }
    }
    const topQueries = [...queryCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    const periodMs = Date.now() - since;
    const rpm = filtered.length / (periodMs / 60000);

    return {
      totalRequests: filtered.length,
      uniqueAgents: agents.size,
      avgResponseTimeMs: Math.round(avgTime),
      cacheHitRate: Math.round((cached / filtered.length) * 100) / 100,
      topTools,
      topQueries,
      escalationRate: Math.round((escalated / filtered.length) * 100) / 100,
      brandViolationCount: violations,
      requestsPerMinute: Math.round(rpm * 10) / 10,
      period: { start: since, end: Date.now() },
    };
  }

  recentEvents(limit = 20): AgentEvent[] {
    return this.events.slice(-limit).reverse();
  }
}
