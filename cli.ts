#!/usr/bin/env tsx

/**
 * AgentWeb CLI — Unified entry point
 *
 * Commands:
 *   agentweb score <url>           Score a site's agent readiness
 *   agentweb init [url]            Generate a starter agent.json
 *   agentweb generate --from <spec> Generate an MCP server from an API spec
 *   agentweb validate <file>       Validate an agent.json file
 */

const args = process.argv.slice(2);
const command = args[0];

const HELP = `
  AgentWeb — Make the web agent-ready.

  Usage:
    agentweb <command> [options]

  Commands:
    score <url>              Score a website's agent readiness (0-100)
    init [url]               Generate a starter agent.json for your site
    generate --from <spec>   Generate an MCP server from an API spec
    validate <file>          Validate an agent.json file

  Examples:
    npx agentweb score https://stripe.com
    npx agentweb score https://amazon.com https://nike.com --compare
    npx agentweb init https://mysite.com --output agent.json
    npx agentweb generate --from openapi.yaml --output ./my-mcp-server
    npx agentweb validate ./agent.json

  Learn more: https://github.com/ashpfeif12/agentweb
`;

if (!command || command === "--help" || command === "-h") {
  console.log(HELP);
  process.exit(0);
}

if (command === "--version" || command === "-v") {
  console.log("  agentweb v0.1.0");
  process.exit(0);
}

switch (command) {
  case "score": {
    const { crawl } = await import("./packages/scorer/src/crawler.js");
    const { score, formatReport } = await import("./packages/scorer/src/scorer.js");
    const scoreArgs = args.slice(1);
    const urls = scoreArgs.filter((a: string) => a.startsWith("http"));
    const jsonOut = scoreArgs.includes("--json");
    if (urls.length === 0 || scoreArgs.includes("--help")) {
      console.log("\n  agentweb score — Score a website's agent readiness\n\n  Usage: agentweb score <url> [--json] [--compare] [--output file]\n");
      process.exit(urls.length === 0 ? 1 : 0);
    }
    for (const u of urls) {
      console.log("  Scoring " + u + "...\n");
      const data = await crawl(u);
      const report = score(data);
      console.log(formatReport(report, jsonOut));
    }
    break;
  }

  case "init":
    runInit(args.slice(1));
    break;

  case "generate": {
    const genArgs = args.slice(1);
    if (genArgs.length === 0 || genArgs.includes("--help")) {
      const { execSync } = await import("child_process");
      execSync("node packages/generator/dist/cli.js --help", { stdio: "inherit" });
    } else {
      const { execSync } = await import("child_process");
      execSync("node packages/generator/dist/cli.js " + genArgs.join(" "), { stdio: "inherit" });
    }
    break;
  }

  case "validate":
    runValidate(args.slice(1));
    break;

  default:
    console.log(`  Unknown command: ${command}\n`);
    console.log(HELP);
    process.exit(1);
}

// ─── Inline: Init ────────────────────────────────────────────

async function runInit(initArgs: string[]) {
  const url = initArgs.find(a => a.startsWith("http") || (a.includes(".") && !a.startsWith("-")));
  const outputIdx = initArgs.indexOf("--output");
  const output = outputIdx !== -1 ? initArgs[outputIdx + 1] : "./agent.json";
  const nameIdx = initArgs.indexOf("--name");
  const name = nameIdx !== -1 ? initArgs[nameIdx + 1] : undefined;
  const industryIdx = initArgs.indexOf("--industry");
  const industry = industryIdx !== -1 ? initArgs[industryIdx + 1] : undefined;

  if (initArgs.includes("--help")) {
    console.log(`
  agentweb init — Generate a starter agent.json

  Usage:
    agentweb init [url] [options]

  Options:
    --name <n>         Service/brand name
    --industry <type>     Industry (retail, food_service, hospitality, healthcare, media, technology, finance)
    --output <path>       Output file path (default: ./agent.json)

  Examples:
    agentweb init https://mystore.com
    agentweb init --name "My Store" --industry retail
    agentweb init https://mysite.com --output public/agent.json
`);
    return;
  }

  // Generate a template based on industry or a generic one
  const template = generateTemplate(name, industry, url);

  const fs = await import("fs");
  fs.writeFileSync(output, JSON.stringify(template, null, 2));

  console.log(`
  ✓ Generated ${output}

  Your starter agent.json has been created with:
    • ${(template.capabilities as Array<unknown>).length} suggested capabilities for ${industry || "your"} industry
    • Brand voice template
    • Policy placeholders
    • Escalation triggers

  Next steps:
    1. Edit the file — fill in [bracketed placeholders]
    2. Add your API endpoints
    3. Place at your domain root: https://yourdomain.com/agent.json
    4. Validate: npx agentweb validate ${output}
    5. Score: npx agentweb score https://yourdomain.com
`);
}

function generateTemplate(
  name?: string,
  industry?: string,
  url?: string
): Record<string, unknown> {
  const brandName = name || (url ? extractName(url) : "My Service");
  const ind = industry || "other";

  const capsByIndustry: Record<string, Array<Record<string, unknown>>> = {
    retail: [
      { name: "search_products", description: "Find products by category, price, attributes, or natural language", type: "query", tags: ["catalog", "search"] },
      { name: "check_availability", description: "Check real-time inventory for a product", type: "query", tags: ["inventory"] },
      { name: "place_order", description: "Add items to cart and complete purchase", type: "action", requires_auth: true, tags: ["commerce"] },
      { name: "track_order", description: "Get shipping status for an existing order", type: "query", requires_auth: true, tags: ["shipping"] },
      { name: "process_return", description: "Initiate a return or exchange", type: "action", requires_auth: true, tags: ["returns"] },
    ],
    food_service: [
      { name: "view_menu", description: "Browse current menu with prices and dietary info", type: "query", tags: ["menu"] },
      { name: "check_availability", description: "Check table availability for a date and party size", type: "query", tags: ["reservation"] },
      { name: "make_reservation", description: "Book a table", type: "action", tags: ["booking"] },
      { name: "order_takeout", description: "Place a takeout or delivery order", type: "action", requires_auth: true, tags: ["ordering"] },
    ],
    hospitality: [
      { name: "search_rooms", description: "Search available rooms by date, type, and preferences", type: "query", tags: ["rooms"] },
      { name: "book_room", description: "Reserve a room for specified dates", type: "action", requires_auth: true, tags: ["booking"] },
      { name: "check_availability", description: "Check room availability for specific dates", type: "query", tags: ["availability"] },
    ],
    healthcare: [
      { name: "find_provider", description: "Search for providers by specialty and availability", type: "query", tags: ["providers"] },
      { name: "book_appointment", description: "Schedule an appointment", type: "action", requires_auth: true, tags: ["scheduling"] },
      { name: "verify_insurance", description: "Check insurance acceptance and coverage", type: "query", tags: ["insurance"] },
    ],
    technology: [
      { name: "query_data", description: "Query your service's data via API", type: "query", requires_auth: true, tags: ["api", "data"] },
      { name: "create_resource", description: "Create a new resource via API", type: "action", requires_auth: true, tags: ["api"] },
      { name: "list_resources", description: "List available resources", type: "query", requires_auth: true, tags: ["api"] },
    ],
    media: [
      { name: "search_content", description: "Search published articles and content", type: "query", tags: ["search"] },
      { name: "get_latest", description: "Get the most recent published content", type: "query", tags: ["feed"] },
    ],
    other: [
      { name: "get_info", description: "[Describe what agents can query from your service]", type: "query", tags: ["info"] },
      { name: "take_action", description: "[Describe the primary action agents can take]", type: "action", tags: ["action"] },
    ],
  };

  const tones: Record<string, string> = {
    retail: "friendly, helpful, knowledgeable about products. Never pushy.",
    food_service: "warm, casual, passionate about food.",
    hospitality: "welcoming, professional, attentive to needs.",
    healthcare: "caring, professional, clear. Prioritize patient safety.",
    technology: "technical, precise, helpful.",
    media: "informative, balanced, trustworthy.",
    other: "professional, helpful, accurate.",
  };

  return {
    name: brandName,
    version: "1.0.0",
    spec_version: "1.0",
    description: `[Describe what ${brandName} does — be specific, agents use this to decide relevance]`,
    capabilities: capsByIndustry[ind] || capsByIndustry.other,
    authentication: { type: "none" },
    policies: {
      rate_limit: "100/minute",
      data_handling: "no_training_on_interactions",
    },
    brand_voice: {
      tone: tones[ind] || tones.other,
      prohibited: ["competitor disparagement", "unauthorized discounts"],
      preferred_name: brandName,
    },
    endpoints: {
      rest: url ? `${url}/api/v1` : "https://api.yourdomain.com/v1",
      docs: url ? `${url}/developers` : "https://developers.yourdomain.com",
    },
    humans: {
      triggers: ["complaint", "legal_question"],
      channels: [],
      handoff_protocol: "transfer_context",
    },
    metadata: {
      industry: ind,
      languages: ["en"],
      updated: new Date().toISOString(),
    },
  };
}

// ─── Inline: Validate ────────────────────────────────────────

async function runValidate(valArgs: string[]) {
  const file = valArgs[0];
  if (!file) {
    console.log("  Usage: agentweb validate <path-to-agent.json>");
    return;
  }

  const fs = await import("fs");
  try {
    const content = fs.readFileSync(file, "utf-8");
    const json = JSON.parse(content);

    // Basic validation
    const required = ["name", "spec_version", "description", "capabilities"];
    const missing = required.filter((k: string) => !json[k]);

    if (missing.length > 0) {
      console.log(`\n  ✗ Invalid agent.json — missing required fields: ${missing.join(", ")}\n`);
      process.exit(1);
    }

    const caps = json.capabilities || [];
    const warnings: string[] = [];

    if (!json.authentication) warnings.push("No authentication defined");
    if (!json.policies) warnings.push("No policies defined");
    if (!json.brand_voice) warnings.push("No brand voice guidelines");
    if (!json.endpoints) warnings.push("No endpoints defined");
    if (!json.humans) warnings.push("No human escalation paths");
    if (!json.version) warnings.push("No version set");

    console.log(`\n  ✓ Valid agent.json`);
    console.log(`    Name: ${json.name}`);
    console.log(`    Spec version: ${json.spec_version}`);
    console.log(`    Capabilities: ${caps.length}`);
    if (json.actions) console.log(`    Actions: ${json.actions.length}`);
    if (json.endpoints) console.log(`    Endpoints: ${Object.keys(json.endpoints).join(", ")}`);

    if (warnings.length > 0) {
      console.log(`\n  Warnings (${warnings.length}):`);
      warnings.forEach((w: string) => console.log(`    ⚠ ${w}`));
    }

    console.log("");
  } catch (err) {
    console.log(`\n  ✗ Error reading ${file}: ${err}\n`);
    process.exit(1);
  }
}

function extractName(url: string): string {
  try {
    const host = new URL(url).hostname.replace("www.", "");
    const name = host.split(".")[0] || "My Service";
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return "My Service";
  }
}
