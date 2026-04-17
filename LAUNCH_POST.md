# We Scored the Top 10 Websites on Agent Readiness — They All Failed

**TL;DR**: We built an open-source tool that scores any website on how ready it is for AI agents. We scored Amazon, Stripe, GitHub, Shopify, OpenAI, and more. Average score: 40 out of 100. Every single site got an F. The web is not agent-ready, and that's a massive infrastructure gap.

## The Problem

The web was built for browsers. But AI agents are the next consumer — and they're flying blind.

When you ask Claude or ChatGPT to "find me a summer dress under $200 from a sustainable brand," the agent has no standardized way to:
- Discover what a site offers
- Know what actions are available (search, purchase, return)
- Understand business policies (shipping, returns, price matching)
- Know how the brand wants to be represented
- Know when to hand off to a human

There's a `robots.txt` for search engines. There's nothing for agents.

## What We Built

**agent.json** — an open spec that sits at your domain root and tells AI agents what you do and how to interact. Think of it as `robots.txt` for the agent era.

Plus a **readiness scorer** that evaluates any website across four dimensions:

| Dimension | What It Measures | Max Score |
|-----------|-----------------|-----------|
| Discovery | Can agents find you? (agent.json, llms.txt, sitemap) | 25 |
| Structure | Is content semantically structured? (Schema.org, semantic HTML) | 25 |
| Actions | Can agents do things? (API, MCP endpoint, action schemas) | 25 |
| Policies | Are rules clear? (Rate limits, auth, brand voice, escalation) | 25 |

## The Scores

| Rank | Site | Discovery | Structure | Actions | Policies | Total | Grade |
|------|------|-----------|-----------|---------|----------|-------|-------|
| 1 | openai.com | 8 | 20 | 12 | 8 | **48** | F |
| 2 | stripe.com | 5 | 20 | 12 | 8 | **45** | F |
| 3 | github.com | 5 | 20 | 12 | 8 | **45** | F |
| 4 | anthropic.com | 5 | 20 | 12 | 8 | **45** | F |
| 5 | shopify.com | 5 | 20 | 10 | 8 | **43** | F |
| 6 | nytimes.com | 5 | 20 | 10 | 8 | **43** | F |
| 7 | airbnb.com | 5 | 20 | 10 | 8 | **43** | F |
| 8 | nike.com | 5 | 20 | 10 | 3 | **38** | F |
| 9 | amazon.com | 5 | 13 | 10 | 8 | **36** | F |
| 10 | netflix.com | 2 | 5 | 2 | 3 | **12** | F |

**Average: 40/100. Every site fails.**

## What's Interesting

The foundation exists — 9 out of 10 sites have Schema.org markup, 8 out of 10 have APIs. The semantic layer is there. But nobody has taken the next step: telling agents what they can *do* with that data.

**Zero sites** declare capabilities for agents. **Zero** define brand voice guidelines (how agents should represent them). **Zero** have MCP endpoints. **Zero** define human escalation paths.

OpenAI edges ahead only because they have an `llms.txt` file — the one site that thought about LLM consumption at all.

## The Analogy

This feels like 2005 web — sites existed but weren't mobile-ready. It took responsive design, AMP, and mobile-first frameworks to bridge the gap. We're at the same inflection point for agents.

The same pattern keeps repeating:
- HTML → RSS → RDF (same content, optimized for different consumers)
- Desktop → Mobile → Agent (same services, new consumption paradigm)
- robots.txt → llms.txt → **agent.json** (machine-readable discovery)

A major global fashion brand we spoke with is planning a 10:90 browser-to-non-browser budget split by 2027. Enterprise budgets are already moving. The tooling hasn't caught up.

## What agent.json Looks Like

```json
{
  "name": "Your Brand",
  "spec_version": "1.0",
  "description": "What you do — written for agents, not humans",
  "capabilities": [
    { "name": "search_products", "type": "query" },
    { "name": "place_order", "type": "action" }
  ],
  "brand_voice": {
    "tone": "warm, knowledgeable, never pushy",
    "prohibited": ["competitor disparagement"]
  },
  "endpoints": { "mcp": "https://mcp.yourbrand.com/sse" }
}
```

Four required fields. Takes 2 minutes to create.

## Score Your Own Site

```bash
npx agentweb score https://yoursite.com
```

## Links

- **GitHub**: github.com/agentweb/agentweb
- **Full spec**: agent.json documentation
- **Examples**: Retail, restaurant, healthcare, SaaS
- **MCP Generator**: Auto-generate MCP servers from your existing API

We're building this in the open because the spec should be community-owned, not vendor-controlled. PRs, spec proposals, and industry examples welcome.

---

*The spec is the wedge. The platform is the business. The timing is now.*
