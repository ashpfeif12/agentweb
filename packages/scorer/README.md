# @agentweb-dev/scorer

Score any website on **agent readiness** (0–100) with actionable recommendations.

```bash
npx agentweb score https://yoursite.com
```

## How It Works

The scorer crawls a target URL and evaluates it across four dimensions:

| Dimension | Max | What It Measures |
|-----------|-----|-----------------|
| **Discovery** | 25 | Can agents find and understand what you offer? (agent.json, llms.txt, sitemap) |
| **Structure** | 25 | Is content semantically structured? (Schema.org, semantic HTML, data schemas) |
| **Actions** | 25 | Can agents do things? (API availability, MCP endpoint, action definitions) |
| **Policies** | 25 | Are rules clear? (Rate limits, auth, data handling, brand voice, escalation) |

### Grading Scale

| Score | Grade | Meaning |
|-------|-------|---------|
| 90-100 | A+ | Agent-ready. Best in class. |
| 80-89 | A | Strong agent presence. Minor improvements possible. |
| 70-79 | B | Good foundation. Key gaps to address. |
| 60-69 | C | Partial agent readiness. Significant gaps. |
| 50-59 | D | Minimal agent readiness. Major work needed. |
| 0-49 | F | Not agent-ready. Start with agent.json. |

## Usage

### CLI

```bash
# Score a URL
npx agentweb score https://example.com

# Output as JSON
npx agentweb score https://example.com --json

# Score multiple sites
npx agentweb score https://site1.com https://site2.com --compare

# Save report
npx agentweb score https://example.com --output report.json
```

### Programmatic

```typescript
import { score, formatReport } from '@agentweb-dev/scorer';

const siteData = await crawl('https://example.com');
const report = score(siteData);

console.log(formatReport(report));
// Or use report.total, report.breakdown, report.topRecommendations
```

## What Gets Checked

### Discovery (25 points)
- **agent.json manifest** (10 pts) — Is there an agent.json at the domain root?
- **Capabilities declared** (4 pts) — Does agent.json list what agents can do?
- **Service description** (3 pts) — Is there a good description for agent decision-making?
- **llms.txt** (3 pts) — Is there an llms.txt for LLM context?
- **Sitemap** (3 pts) — Is there a sitemap.xml?
- **robots.txt** (2 pts) — Is there a robots.txt?

### Structure (25 points)
- **Schema.org markup** (8 pts) — JSON-LD structured data on pages?
- **Data schemas declared** (5 pts) — Data types defined in agent.json?
- **Semantic HTML** (4 pts) — Uses article, nav, section, main elements?
- **Heading hierarchy** (3 pts) — Proper h1 → h2 → h3 structure?
- **HTTPS** (3 pts) — Secure connection?
- **Meta description** (2 pts) — Page-level descriptions present?

### Actions (25 points)
- **API availability** (8 pts) — OpenAPI, GraphQL, or REST API detected?
- **MCP endpoint** (7 pts) — MCP server available?
- **Actions defined** (6 pts) — Actions with schemas in agent.json?
- **CORS headers** (2 pts) — Cross-origin requests allowed?
- **Response time** (2 pts) — Sub-500ms response?

### Policies (25 points)
- **Rate limit policy** (5 pts) — Rate limits defined?
- **Authentication defined** (5 pts) — Auth method specified?
- **Data handling policy** (4 pts) — Data rules for agent platforms?
- **Brand voice guidelines** (4 pts) — Tone and representation rules?
- **Human escalation paths** (4 pts) — When/how to hand off to humans?
- **Terms & Privacy** (3 pts) — ToS and privacy policy present?

## License

MIT
