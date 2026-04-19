# We Scored the Top 100 Sites on Agent Readiness. Every Single One Failed.

**The web has a front door for browsers. It doesn't have one for agents.**

We built a scoring framework and ran it against the 100 most-visited sites on the internet. The results were worse than we expected.

Average score: **40 out of 100**. Highest score: **48**. Number of sites that passed: **zero**.

The semantic foundation is there — most sites have Schema.org markup, HTTPS, clean APIs, proper heading structure. But not a single site tells AI agents what it can do, how to interact with it, or when to hand off to a human.

The web is optimized for browsers. It's completely unprepared for agents.

---

## The Scoring Framework

We evaluate agent readiness across four dimensions, 25 points each, for a total possible score of 100.

### Discovery (0–25)
Can an agent find out what your site does?

- Does the site have an `agent.json` manifest? (0–10)
- Is there an `llms.txt` file? (0–3)
- Are capabilities described in machine-readable format? (0–5)
- Is there an MCP endpoint? (0–7)

### Structure (0–25)
Is the content semantically organized?

- Schema.org / JSON-LD markup present? (0–8)
- Clean HTML with semantic headings? (0–5)
- Sitemap available and complete? (0–4)
- Meta descriptions and Open Graph tags? (0–4)
- HTTPS? (0–4)

### Actions (0–25)
Can an agent actually do things on the site?

- Public API available? (0–8)
- API has formal spec (OpenAPI, GraphQL schema)? (0–6)
- Actions have input/output schemas? (0–6)
- Authentication is documented and machine-readable? (0–5)

### Policies (0–25)
Does the site set rules for agent behavior?

- Rate limits defined? (0–5)
- Terms of service discoverable? (0–4)
- Data handling policy stated? (0–4)
- Brand voice guidelines provided? (0–4)
- Human escalation paths defined? (0–4)
- Return/refund/shipping policies machine-readable? (0–4)

---

## The Results

### Top 10 Sites — Ranked by Score

| Rank | Site | Discovery | Structure | Actions | Policies | Total | Grade |
|------|------|-----------|-----------|---------|----------|-------|-------|
| 1 | openai.com | 8/25 | 20/25 | 12/25 | 8/25 | **48** | F |
| 2 | stripe.com | 5/25 | 20/25 | 12/25 | 8/25 | **45** | F |
| 3 | github.com | 5/25 | 20/25 | 12/25 | 8/25 | **45** | F |
| 4 | anthropic.com | 5/25 | 20/25 | 12/25 | 8/25 | **45** | F |
| 5 | shopify.com | 5/25 | 20/25 | 10/25 | 8/25 | **43** | F |
| 6 | nytimes.com | 5/25 | 20/25 | 10/25 | 8/25 | **43** | F |
| 7 | airbnb.com | 5/25 | 20/25 | 10/25 | 8/25 | **43** | F |
| 8 | nike.com | 5/25 | 20/25 | 10/25 | 3/25 | **38** | F |
| 9 | amazon.com | 5/25 | 13/25 | 10/25 | 8/25 | **36** | F |
| 10 | netflix.com | 2/25 | 5/25 | 2/25 | 3/25 | **12** | F |

### Key Numbers

- **0 out of 100** sites have an `agent.json` manifest
- **0 out of 100** expose MCP endpoints
- **0 out of 100** define brand voice guidelines for agents
- **0 out of 100** define human escalation paths
- **1 out of 100** has an `llms.txt` file (openai.com)
- **Average score: 40/100**

### Where the Points Come From

Most sites score well on Structure (Schema.org, clean HTML, sitemaps) and modestly on Actions (APIs exist, some have formal specs). Nearly all score zero on the Discovery and Policy dimensions that are specific to agent interaction.

The pattern is clear: the web has invested heavily in making content readable by search engine crawlers. It has invested nothing in making capabilities discoverable by AI agents.

---

## What's Missing

The gap isn't content or APIs. The gap is the **capability and policy layer** — the part that tells agents:

1. **What can I do here?** Not just "this is a shopping site" but "you can search products, check inventory, place orders, and process returns."

2. **How do I interact?** Not just "there's an API" but "here's the MCP endpoint, here's how to authenticate, here are the input/output schemas for each action."

3. **What are the rules?** Not just "we have terms of service somewhere" but "rate limit is 100/minute, don't use competitor comparisons, escalate complaints to humans."

4. **How should I represent this brand?** Not just nothing, but "our tone is warm and knowledgeable, never pushy. Don't offer unauthorized discounts. Always mention our sustainability commitment."

5. **When should I stop and get a human?** Not just nothing, but "escalate legal questions, orders over $500, allergy concerns, and anyone who seems distressed."

No site on the internet answers these questions in a machine-readable format. That's the problem.

---

## The Fix: agent.json

We built `agent.json` — an open spec that answers all five questions in a single file at your domain root. Think of it as `robots.txt` for the agent era.

```json
{
  "name": "Acme Fashion",
  "spec_version": "1.0",
  "description": "Premium fashion retailer with 2,000+ products",
  "capabilities": [
    { "name": "search_products", "type": "query" },
    { "name": "place_order", "type": "action" },
    { "name": "process_return", "type": "action" }
  ],
  "brand_voice": {
    "tone": "warm, knowledgeable, never pushy",
    "prohibited": ["competitor comparisons", "unauthorized discounts"]
  },
  "policies": {
    "rate_limit": "100/minute",
    "returns": "30-day no-questions-asked",
    "data_handling": "no_training_on_interactions"
  },
  "endpoints": {
    "mcp": "https://mcp.acmefashion.com/sse"
  },
  "humans": {
    "triggers": ["complaint", "order_value_over_500", "legal_question"],
    "channels": [{ "type": "email", "url": "support@acmefashion.com" }]
  }
}
```

Four required fields. Two minutes to create. One file that makes your entire site agent-discoverable.

---

## Score Your Own Site

We open-sourced the scorer. Run it against any URL:

```bash
npx agentweb score https://yoursite.com
```

You'll get a breakdown across all four dimensions with specific recommendations for what to fix.

Then generate your starter `agent.json`:

```bash
npx agentweb init --industry retail --output agent.json
```

This creates a pre-filled manifest with capabilities, brand voice, policies, and escalation triggers appropriate for your industry. Edit the placeholders, drop it at your domain root, and you're agent-ready.

---

## The Bigger Picture

`agent.json` is layer 1 of AgentWeb — an open platform for the agent-driven web. The full stack:

| Layer | Package | What It Does |
|-------|---------|-------------|
| 1 | `@agentweb-dev/spec` | agent.json spec, JSON Schema, validator |
| 2 | `@agentweb-dev/scorer` | Agent readiness scorer CLI |
| 3 | `@agentweb-dev/generator` | OpenAPI spec → deployable MCP server |
| 4 | `@agentweb-dev/middleware` | Proxy that makes any site agent-consumable |
| 5 | `@agentweb-dev/commerce` | Structured catalogs + agent-to-agent negotiation |
| 6 | `@agentweb-dev/seo` | Agent visibility analytics + optimization |

All open source. All shipped.

The middleware is particularly interesting: point it at any website and it creates an MCP server in front of it — no code changes on the origin. Agents get tools for browsing, searching, extracting structured data, checking policies, and escalating to humans. One command:

```bash
npx @agentweb-dev/middleware --origin https://yoursite.com
```

---

## Why Now

The web has followed a consistent pattern: the same content gets optimized for new consumer types. HTML served browsers. RSS served feed readers. Each transition created massive value for the companies that built the bridge tooling.

We're at the next transition. AI agents are becoming a primary way people interact with businesses — through Siri, Claude, ChatGPT, and whatever comes next. But the web has no agent layer. Every site is a black box to every agent.

That changes when sites start publishing `agent.json`. The first movers get discovered first. The laggards become invisible to the fastest-growing interaction channel on the internet.

The spec is the wedge. The platform is the business. The timing is now.

---

**Star the repo:** [github.com/ashpfeif12/agentweb](https://github.com/ashpfeif12/agentweb)

**Score your site:** `npx agentweb score https://yoursite.com`

**Ship your agent.json:** `npx agentweb init --output agent.json`

---

*Built by [@ashpfeif12](https://github.com/ashpfeif12). MIT License. April 2026.*
