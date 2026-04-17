# @agentweb/generator

Auto-generate deployable MCP servers from existing APIs.

```bash
# From OpenAPI spec
npx agentweb generate --from openapi.yaml

# From GraphQL schema
npx agentweb generate --from schema.graphql

# From a live website (experimental)
npx agentweb generate --from https://example.com
```

## What It Generates

A complete, deployable package:

```
my-mcp-server/
├── src/
│   ├── server.ts          # MCP server with all tools defined
│   ├── tools/             # One file per tool/endpoint
│   ├── auth.ts            # Authentication handling
│   └── types.ts           # TypeScript types from API schemas
├── agent.json             # Auto-generated manifest
├── Dockerfile             # Ready to deploy
├── package.json
├── tsconfig.json
├── README.md              # Auto-generated docs with tool descriptions
└── tests/
    └── tools.test.ts      # Integration tests per tool
```

## Supported Inputs

| Input | Status | Notes |
|-------|--------|-------|
| OpenAPI 3.x (JSON/YAML) | ✅ Stable | Full endpoint + schema mapping |
| GraphQL schema | ✅ Stable | Query/mutation → tool mapping |
| REST API (no spec) | 🧪 Beta | Infers structure from responses |
| Website (no API) | 🧪 Experimental | Scrapes structured content |
| agent.json | ✅ Stable | Scaffolds from declared capabilities |

## How It Works

The generator is a pipeline:

1. **Input Parser** — Reads the source (OpenAPI, GraphQL, URL) and extracts endpoint definitions, schemas, and auth requirements
2. **Capability Mapper** — Maps API endpoints to MCP tool definitions with appropriate names, descriptions, and annotations
3. **Tool Generator** — Generates TypeScript code for each tool with proper types, validation, and error handling
4. **Server Builder** — Assembles the MCP server with tool registration, auth middleware, and transport configuration
5. **Packager** — Produces the final package with Dockerfile, agent.json, tests, and docs

Each stage is pluggable — contribute new input parsers or output formats.

## Options

```bash
npx agentweb generate \
  --from openapi.yaml \          # Input source (file or URL)
  --output ./my-mcp-server \     # Output directory
  --name "My Service" \          # Service name (auto-detected if omitted)
  --transport sse \              # MCP transport: sse | streamable-http | stdio
  --language typescript \        # Output language: typescript | python
  --deploy fly.io \              # Auto-deploy to platform (optional)
  --no-docker \                  # Skip Dockerfile generation
  --no-tests                     # Skip test generation
```

## Key Features

- **Authentication pass-through**: Handles OAuth2, API keys, bearer tokens without you touching MCP auth internals
- **Schema inference**: When formal specs don't exist, infers from live API responses
- **agent.json auto-generation**: Every generated server gets a matching agent.json
- **Sensible defaults**: Rate limiting, error handling, retry logic built in
- **Annotations**: Auto-sets readOnlyHint, destructiveHint, idempotentHint based on HTTP methods

## Architecture

```
                    ┌─────────────┐
                    │ Input Source │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ OpenAPI  │ │ GraphQL  │ │ Website  │
        │ Parser   │ │ Parser   │ │ Scraper  │
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             │             │             │
             └─────────────┼─────────────┘
                           ▼
                  ┌─────────────────┐
                  │ Capability Map  │  Unified intermediate format
                  └────────┬────────┘
                           ▼
                  ┌─────────────────┐
                  │ Tool Generator  │  One tool per capability
                  └────────┬────────┘
                           ▼
                  ┌─────────────────┐
                  │ Server Builder  │  MCP server assembly
                  └────────┬────────┘
                           ▼
                  ┌─────────────────┐
                  │   Packager      │  Dockerfile, agent.json, tests
                  └─────────────────┘
```

## License

MIT
