# 🌐 AgentWeb

**Make the web agent-ready.**

AgentWeb is an open platform for bridging the browser-centric web and the emerging agent-driven web. It provides a spec, tools, and infrastructure so AI agents can discover, query, and transact with any website or service.

```bash
# Score any site's agent readiness in 30 seconds
npx agentweb score https://yoursite.com

# Generate an MCP server from your existing API
npx agentweb generate --from openapi.yaml
```

## The Problem

The web was built for browsers. AI agents are the next consumer — but they can't discover what your site does, what actions are available, or how to interact with it. There's no `robots.txt` for agents. No structured way to say "here's what I offer and how to use it."

**Result:** Every agent integration is bespoke. Every brand is invisible to agents. The infrastructure gap is massive.

## The Solution: Five Layers

| Layer | What | Type |
|-------|------|------|
| **agent.json** | Open spec describing what your site offers to agents | 🟢 Open Source |
| **MCP Generator** | Auto-generate MCP servers from existing APIs | 🟢 Open Source |
| **Agent Middleware** | Proxy layer making any site agent-consumable | 🔵 Commercial |
| **Agent Commerce** | Structured catalogs & policies for agent negotiation | 🔵 Commercial |
| **Agent SEO** | Analytics for how agents discover your brand | 🔵 Commercial |

Open source bottom creates adoption. Commercial top solves enterprise problems.

---

## 📋 agent.json — The Spec

Drop an `agent.json` at your domain root. It tells agents what you do and how to interact:

```json
{
  "name": "Acme Fashion",
  "version": "1.0.0",
  "spec_version": "1.0",
  "description": "Premium fashion retailer — 2,000+ products across women's and men's collections",
  "capabilities": [
    {
      "name": "search_products",
      "description": "Find products by category, color, size, price range, or occasion",
      "type": "query"
    },
    {
      "name": "place_order",
      "description": "Add items to cart and complete purchase",
      "type": "action"
    }
  ],
  "authentication": {
    "type": "oauth2",
    "authorization_url": "https://acmefashion.com/oauth/authorize",
    "scopes": ["read_catalog", "place_orders"]
  },
  "policies": {
    "rate_limit": "100/minute",
    "returns": "30-day no-questions-asked",
    "data_handling": "no_training_on_interactions"
  },
  "brand_voice": {
    "tone": "warm, knowledgeable, never pushy",
    "prohibited": ["competitor comparisons", "unauthorized discounts"]
  },
  "endpoints": {
    "mcp": "https://mcp.acmefashion.com/sse",
    "rest": "https://api.acmefashion.com/v2",
    "docs": "https://developers.acmefashion.com"
  }
}
```

[📖 Full spec documentation →](./packages/spec/README.md)

---

## 📊 Readiness Scorer

Score any website on agent readiness (0–100):

```bash
npx agentweb score https://example.com
```

```
┌─────────────────────────────────────────┐
│  Agent Readiness Report: example.com    │
├─────────────────────────────────────────┤
│  Discovery    ██████░░░░░░  14/25       │
│  Structure    ████████░░░░  18/25       │
│  Actions      ██░░░░░░░░░░   6/25      │
│  Policies     █░░░░░░░░░░░   4/25      │
├─────────────────────────────────────────┤
│  TOTAL SCORE          42/100            │
│                                         │
│  Top recommendations:                   │
│  1. Add agent.json manifest             │
│  2. Define action schemas               │
│  3. Add machine-readable policies       │
└─────────────────────────────────────────┘
```

[📖 Scorer documentation →](./packages/scorer/README.md)

---

## ⚡ MCP Server Generator

Generate a fully functional MCP server from your existing API:

```bash
# From OpenAPI spec
npx agentweb generate --from openapi.yaml --output ./my-mcp-server

# From GraphQL schema
npx agentweb generate --from schema.graphql --output ./my-mcp-server

# From a live website (experimental)
npx agentweb generate --from https://example.com --output ./my-mcp-server
```

Outputs a complete, deployable package: MCP server code, Dockerfile, agent.json, tests, and README.

[📖 Generator documentation →](./packages/generator/README.md)

---

## 🏗 Project Structure

```
agentweb/
├── packages/
│   ├── spec/          # agent.json JSON Schema + TypeScript types + validation
│   ├── scorer/        # CLI readiness scorer
│   └── generator/     # API → MCP server generator
├── examples/          # Example agent.json files by industry
├── apps/
│   └── docs/          # Documentation site
└── .github/
    └── workflows/     # CI/CD
```

## Contributing

We welcome contributions! The spec is designed to evolve with community input.

- 🐛 **Bug reports**: [Open an issue](https://github.com/agentweb/agentweb/issues)
- 💡 **Spec proposals**: [Start a discussion](https://github.com/agentweb/agentweb/discussions)
- 🔧 **Code contributions**: See [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

- `packages/spec` and `packages/scorer` and `packages/generator`: MIT
- Commercial products: Proprietary

---

<p align="center">
  <strong>The spec is the wedge. The platform is the business. The timing is now.</strong>
</p>
