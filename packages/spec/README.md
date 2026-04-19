# @agentweb-dev/spec

The **agent.json** specification — an open standard for describing what a website or service offers to AI agents.

Think of it as `robots.txt` for the agent era: a single file at your domain root that tells AI agents what you do, what actions are available, how to authenticate, and what rules to follow.

## Quick Start

### 1. Create your agent.json

Place an `agent.json` file at your domain root (e.g., `https://yoursite.com/agent.json`):

```json
{
  "name": "Your Service",
  "spec_version": "1.0",
  "description": "What your service does — be specific, agents use this to decide relevance",
  "capabilities": [
    {
      "name": "search_products",
      "description": "Find products by name, category, or price range",
      "type": "query"
    }
  ]
}
```

That's the minimum. Four fields. Takes 2 minutes.

### 2. Validate it

```bash
npx @agentweb-dev/spec validate ./agent.json
```

### 3. Add more sections as needed

The spec supports: capabilities, actions (with I/O schemas), authentication, policies, brand voice, endpoints, human escalation paths, and NLWeb compatibility. Add what's relevant — every section is optional except the four required fields.

## Spec Reference

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Human-readable service name |
| `spec_version` | `"1.0"` | Spec version |
| `description` | string | What you do (max 500 chars). Write for an agent deciding relevance. |
| `capabilities` | Capability[] | What agents can do with your service |

### Optional Sections

| Section | Purpose |
|---------|---------|
| `version` | Your file version (semver) — helps agents detect changes |
| `actions` | Detailed action definitions with input/output JSON Schemas |
| `data_schemas` | Structured data types your service exposes |
| `authentication` | How agents authenticate (none, API key, OAuth2, bearer, MCP auth) |
| `policies` | Rate limits, data handling rules, business policies |
| `brand_voice` | How agents should represent your brand in conversations |
| `endpoints` | Protocol-specific URLs (MCP, REST, GraphQL, NLWeb, A2A) |
| `humans` | When and how to escalate to human support |
| `nlweb` | NLWeb protocol compatibility |
| `metadata` | Industry, regions, languages, last updated |

### Capability Types

| Type | Meaning |
|------|---------|
| `query` | Read-only data retrieval |
| `action` | State-changing operation |
| `subscription` | Real-time updates |
| `negotiation` | Multi-turn agent-to-agent interaction |

## Validation

The validator checks:
- Required fields present and valid
- Capability names are snake_case
- No duplicate capability names
- Actions match declared capabilities
- Destructive actions require confirmation
- URLs are valid
- Rate limits follow correct format
- Authentication config is complete for chosen type

Plus quality warnings for missing-but-recommended sections.

```typescript
import { validate, formatIssues } from '@agentweb-dev/spec';

const result = validate(myAgentJson);
if (!result.valid) {
  console.log(formatIssues(result.issues));
}
```

## Examples

See the [examples/](../../examples/) directory for complete agent.json files:
- `retail-fashion.agent.json` — E-commerce fashion brand
- `restaurant.agent.json` — Restaurant with reservations
- `saas-monitoring.agent.json` — Developer tooling / SaaS API

## JSON Schema

The formal JSON Schema is at [`agent.schema.json`](./agent.schema.json). Use it for IDE autocompletion and validation in any JSON Schema-compatible editor.

## Design Principles

1. **Minimal required fields**: Getting started should take 2 minutes, not 2 hours
2. **Progressive disclosure**: Add sections as you need them
3. **Agent-first descriptions**: Text is written for AI agents making decisions, not humans reading docs
4. **Protocol-agnostic**: Works with MCP, NLWeb, A2A, REST, GraphQL — whatever wins
5. **Brand voice is first-class**: Your brand's tone and rules travel with your data
6. **Human escalation built in**: Agents should know their limits

## License

MIT
