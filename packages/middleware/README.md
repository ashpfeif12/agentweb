# @agentweb/middleware

**The Cloudflare for the agent web.**

A managed proxy that sits in front of any website and makes it agent-consumable via MCP. No code changes required on your origin site.

## Quick Start

```bash
# Point at any website
ORIGIN_URL=https://example.com npx agentweb-middleware

# With your agent.json for brand voice + policies
ORIGIN_URL=https://example.com AGENT_JSON=./agent.json npx agentweb-middleware
```

Your site is now agent-ready at `http://localhost:3000/mcp`.

## What It Does

Agents connect to the middleware MCP server and get tools to interact with your site:

| Tool | What It Does |
|------|-------------|
| `browse_site` | Read any page — content extracted, cleaned, and structured |
| `search_site` | Find content across your site |
| `get_structured_data` | Extract Schema.org JSON-LD (products, articles, events) |
| `get_policies` | Return policies, shipping, returns from your agent.json |
| `get_brand_info` | Brand voice, capabilities, endpoints |
| `request_human_help` | Escalate to human support with context handoff |
| `get_analytics` | Traffic metrics, top queries, cache stats (admin) |

## How It Works

```
Agent (Claude, GPT, Siri...)
    │
    ▼
AgentWeb Middleware (MCP Server)
    │  ├─ Rate limiting
    │  ├─ Content caching
    │  ├─ Brand voice enforcement
    │  ├─ Escalation detection
    │  └─ Analytics tracking
    ▼
Your existing website (unchanged)
```

1. Agent sends MCP tool call to the middleware
2. Middleware fetches from your origin, extracts + structures content
3. Brand voice rules are applied (prohibited terms filtered)
4. Structured response returned to agent
5. Everything is cached, rate-limited, and tracked

## Configuration

| Env Variable | Default | Description |
|---|---|---|
| `ORIGIN_URL` | (required) | Your website URL |
| `AGENT_JSON` | (optional) | Path to your agent.json file |
| `PORT` | 3000 | Server port |
| `CACHE_TTL` | 300 | Cache lifetime in seconds |
| `RATE_LIMIT` | 100 | Requests per agent per minute |

## Endpoints

| Path | Method | Description |
|------|--------|-------------|
| `/mcp` | POST | MCP server (Streamable HTTP) |
| `/health` | GET | Health check + cache stats |
| `/agent.json` | GET | Serves agent.json (or auto-generates one) |
| `/analytics` | GET | Traffic analytics JSON |

## With agent.json

When you provide an agent.json, the middleware uses it to:

- **Enforce brand voice** — filters prohibited terms from all responses
- **Serve policies** — returns, shipping, data handling available via `get_policies`
- **Route escalations** — detects triggers and provides correct support channels
- **Describe capabilities** — agents know what they can do before asking

Without an agent.json, the middleware still works — it just won't have brand voice rules or structured policies. Generate one:

```bash
npx agentweb init --industry retail --output agent.json
```

## Pricing (Hosted Version)

| Tier | Agent Requests/mo | Features | Price |
|------|-------------------|----------|-------|
| Free | 10,000 | Basic proxy, caching | $0 |
| Starter | 100,000 | + Analytics, brand voice | $99/mo |
| Business | 1,000,000 | + A/B testing, custom rules | $499/mo |
| Enterprise | Unlimited | + SLA, support, SSO | Custom |

Self-hosted is free and open source forever.

## License

MIT (self-hosted) — Hosted version is commercial.
