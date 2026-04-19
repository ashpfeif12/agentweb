# AgentWeb

**Make the web agent-ready.**

AgentWeb is an open platform for bridging the browser-centric web and the emerging agent-driven web. It provides a spec, tools, and infrastructure so AI agents can discover, query, and transact with any website or service.

## We Scored the Top 10 Sites — They All Failed

| Rank | Site | Discovery | Structure | Actions | Policies | Total | Grade |
|------|------|-----------|-----------|---------|----------|-------|-------|
| 1 | openai.com | 8/25 | 20/25 | 12/25 | 8/25 | **48** | F |
| 2 | stripe.com | 5/25 | 20/25 | 12/25 | 8/25 | **45** | F |
| 3 | github.com | 5/25 | 20/25 | 12/25 | 8/25 | **45** | F |
| 4 | anthropic.com | 5/25 | 20/25 | 12/25 | 8/25 | **45** | F |
| 5 | shopify.com | 5/25 | 20/25 | 10/25 | 8/25 | **43** | F |
| 6 | nike.com | 5/25 | 20/25 | 10/25 | 3/25 | **38** | F |
| 7 | amazon.com | 5/25 | 13/25 | 10/25 | 8/25 | **36** | F |
| 8 | netflix.com | 2/25 | 5/25 | 2/25 | 3/25 | **12** | F |

**Average: 40/100.** The semantic foundation exists (Schema.org, APIs), but zero sites tell agents what they can do, how to represent the brand, or when to escalate to humans.

## The Problem

The web was built for browsers. AI agents are the next consumer — but they can't discover what your site does, what actions are available, or how to interact with it. There's no robots.txt for agents.

## agent.json — The Spec

Drop an agent.json at your domain root. It tells agents what you do and how to interact. Four required fields. Two minutes to create.

```json
{
  "name": "Acme Fashion",
  "spec_version": "1.0",
  "description": "Premium fashion retailer with women's and men's collections.",
  "capabilities": [
    { "name": "search_products", "type": "query" },
    { "name": "place_order", "type": "action" }
  ],
  "brand_voice": {
    "tone": "warm, knowledgeable, never pushy"
  },
  "endpoints": {
    "mcp": "https://mcp.acmefashion.com/sse"
  }
}
```

## The Stack

Six packages. All open source. Published to npm.

| Package | Purpose | Status |
|---------|---------|--------|
| `@agentweb/spec` | agent.json spec + JSON Schema + TypeScript types | In repo |
| `@agentweb/scorer` | Agent readiness scorer CLI | In repo |
| `@agentweb/generator` | OpenAPI → deployable MCP server | In repo |
| `@agentweb-dev/middleware` | MCP proxy that makes any site agent-consumable | Published |
| `@agentweb-dev/commerce` | Structured catalog, cart, and agent-to-agent negotiation | Published |
| `@agentweb-dev/seo` | Agent visibility analytics and optimization | Published |

## Quick Start

### Score your site

```bash
npx agentweb score https://yoursite.com
```

### Generate a starter agent.json

```bash
npx agentweb init --industry retail --output agent.json
```

### Proxy your site as an MCP server (middleware)

```bash
npx @agentweb-dev/middleware --origin https://yoursite.com
```

Exposes your site on `http://localhost:3000/mcp` with tools for browsing, structured data extraction, policy lookup, and human escalation.

### Run a commerce MCP server

```bash
npx @agentweb-dev/commerce --brand "Acme" --catalog ./products.json
```

Starts an agent-negotiable commerce endpoint on `http://localhost:3001/mcp`. Runs with a built-in demo catalog if no file is provided.

### Run agent SEO analytics

```bash
npx @agentweb-dev/seo --site https://yoursite.com --brand "Acme"
```

Exposes agent visibility scoring, query pattern analytics, and competitive analysis on `http://localhost:3002/mcp`.

Each CLI supports `--help` for full options, and every flag has an environment variable equivalent (e.g. `ORIGIN_URL`, `CATALOG_FILE`, `SITE_URL`).

## Generate an MCP server from an API spec

Point the generator at any OpenAPI spec and get a deployable MCP server:

```bash
npx agentweb generate --from openapi.yaml --output ./mcp-server
```

Outputs a complete TypeScript package with typed tools, authentication handling, an auto-generated agent.json manifest, and a Dockerfile.

## Development

This is an npm workspace monorepo. To work on it locally:

```bash
git clone https://github.com/ashpfeif12/agentweb.git
cd agentweb
npm install
cd packages/commerce && npm run build
```

Replace `commerce` with `seo` or `middleware` to build the others. Each package is independently buildable and publishable.

## License

MIT — see LICENSE file.
