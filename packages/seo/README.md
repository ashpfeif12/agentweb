# @agentweb/seo

**The Moz for agent discovery.**

Analytics and optimization for how AI agents discover, rank, and recommend your brand.

## Quick Start

```bash
SITE_URL=https://example.com BRAND_NAME="My Brand" npx agentweb-seo
```

Analytics available at `http://localhost:3002/mcp`.

## MCP Tools

| Tool | What It Does |
|------|-------------|
| `get_visibility_score` | Agent visibility score (0-100) across 5 dimensions |
| `get_query_patterns` | What agents ask about your brand, mention rates, sentiment |
| `get_optimization_plan` | Prioritized actions to improve agent discovery |
| `compare_competitors` | Side-by-side agent readiness comparison |

## Visibility Score Dimensions

| Dimension | Weight | What It Measures |
|-----------|--------|-----------------|
| Discoverability | 25% | agent.json, llms.txt, MCP endpoint, API docs |
| Data Quality | 25% | Schema.org coverage, structured data completeness |
| Policy Clarity | 20% | Machine-readable policies, escalation paths |
| Brand Consistency | 15% | Brand voice guidelines, consistent representation |
| Competitive Position | 15% | How you compare to competitors |

## Traditional SEO vs Agent SEO

| | Traditional SEO | Agent SEO |
|---|---|---|
| **What's ranked** | Web pages | Products and services |
| **Key signals** | Keywords, backlinks | Structured data, policy clarity |
| **Output** | 10 blue links | 1-3 specific recommendations |
| **Competition** | Position 1-10 | Winner takes most |
| **Optimization** | Content + technical | Data structure + agent compatibility |

## Pricing (Hosted Version)

| Tier | Features | Price |
|------|----------|-------|
| Free | Visibility score, basic recommendations | $0 |
| Pro | + Query analytics, competitive analysis | $199/mo |
| Business | + Simulation testing, alerts, API access | $499/mo |
| Enterprise | + Custom dashboards, priority support | Custom |

## License

MIT (self-hosted) — Hosted version is commercial.
