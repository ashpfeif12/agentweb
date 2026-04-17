#!/usr/bin/env tsx

/**
 * AgentWeb CLI
 * Commands: score, init, generate, validate
 */

const args = process.argv.slice(2);
const command = args[0];

const HELP = `
  AgentWeb — Make the web agent-ready.

  Commands:
    score <url>              Score a website's agent readiness (0-100)
    init [url]               Generate a starter agent.json for your site
    generate --from <spec>   Generate an MCP server from an API spec
    validate <file>          Validate an agent.json file

  Examples:
    npx agentweb score https://stripe.com
    npx agentweb init --name "My Store" --industry retail
    npx agentweb generate --from openapi.yaml
    npx agentweb validate ./agent.json

  https://github.com/ashpfeif12/agentweb
`;

if (!command || command === "--help" || command === "-h") {
  console.log(HELP);
  process.exit(0);
}

switch (command) {
  case "score":
    console.log("  Run: tsx run-scorer.ts " + args.slice(1).join(" "));
    break;

  case "init":
    runInit(args.slice(1));
    break;

  case "generate":
    console.log("  Run: tsx packages/generator/src/cli.ts " + args.slice(1).join(" "));
    break;

  case "validate":
    runValidate(args.slice(1));
    break;

  default:
    console.log("  Unknown command: " + command);
    console.log(HELP);
    process.exit(1);
}

function runInit(initArgs: string[]) {
  const nameIdx = initArgs.indexOf("--name");
  const name = nameIdx !== -1 ? initArgs[nameIdx + 1] : undefined;
  const industryIdx = initArgs.indexOf("--industry");
  const industry = industryIdx !== -1 ? initArgs[industryIdx + 1] : undefined;
  const outputIdx = initArgs.indexOf("--output");
  const output = outputIdx !== -1 ? initArgs[outputIdx + 1] : "./agent.json";
  const url = initArgs.find(a => a.startsWith("http") || (a.includes(".") && !a.startsWith("-")));

  if (initArgs.includes("--help")) {
    console.log("\n  agentweb init — Generate a starter agent.json\n\n  Options:\n    --name <name>       Brand name\n    --industry <type>   retail, food_service, hospitality, healthcare, technology, media\n    --output <path>     Output path (default: ./agent.json)\n");
    return;
  }

  const brandName = name || (url ? extractName(url) : "My Service");
  const ind = industry || "other";

  const capsByIndustry: Record<string, Array<Record<string, unknown>>> = {
    retail: [
      { name: "search_products", description: "Find products by category, price, or query", type: "query", tags: ["catalog"] },
      { name: "check_availability", description: "Check inventory for a product", type: "query", tags: ["inventory"] },
      { name: "place_order", description: "Complete a purchase", type: "action", requires_auth: true, tags: ["commerce"] },
      { name: "track_order", description: "Get shipping status", type: "query", requires_auth: true, tags: ["shipping"] },
      { name: "process_return", description: "Initiate a return or exchange", type: "action", requires_auth: true, tags: ["returns"] },
    ],
    food_service: [
      { name: "view_menu", description: "Browse menu with prices and dietary info", type: "query", tags: ["menu"] },
      { name: "check_availability", description: "Check table availability", type: "query", tags: ["reservation"] },
      { name: "make_reservation", description: "Book a table", type: "action", tags: ["booking"] },
    ],
    hospitality: [
      { name: "search_rooms", description: "Search available rooms", type: "query", tags: ["rooms"] },
      { name: "book_room", description: "Reserve a room", type: "action", requires_auth: true, tags: ["booking"] },
      { name: "check_availability", description: "Check room availability", type: "query", tags: ["availability"] },
    ],
    healthcare: [
      { name: "find_provider", description: "Search providers by specialty", type: "query", tags: ["providers"] },
      { name: "book_appointment", description: "Schedule an appointment", type: "action", requires_auth: true, tags: ["scheduling"] },
      { name: "verify_insurance", description: "Check insurance coverage", type: "query", tags: ["insurance"] },
    ],
    technology: [
      { name: "query_data", description: "Query the API for data", type: "query", requires_auth: true, tags: ["api"] },
      { name: "create_resource", description: "Create a resource via API", type: "action", requires_auth: true, tags: ["api"] },
    ],
    media: [
      { name: "search_content", description: "Search published content", type: "query", tags: ["search"] },
      { name: "get_latest", description: "Get most recent content", type: "query", tags: ["feed"] },
    ],
    other: [
      { name: "get_info", description: "[Describe what agents can query]", type: "query", tags: ["info"] },
      { name: "take_action", description: "[Describe the primary action]", type: "action", tags: ["action"] },
    ],
  };

  const tones: Record<string, string> = {
    retail: "friendly, helpful, never pushy.",
    food_service: "warm, casual, passionate about food.",
    hospitality: "welcoming, professional.",
    healthcare: "caring, professional, clear. Prioritize safety.",
    technology: "technical, precise, helpful.",
    media: "informative, balanced, trustworthy.",
    other: "professional, helpful, accurate.",
  };

  const template = {
    name: brandName,
    version: "1.0.0",
    spec_version: "1.0",
    description: "[Describe what " + brandName + " does for agents]",
    capabilities: capsByIndustry[ind] || capsByIndustry.other,
    authentication: { type: "none" },
    policies: { rate_limit: "100/minute", data_handling: "no_training_on_interactions" },
    brand_voice: { tone: tones[ind] || tones.other, prohibited: ["competitor disparagement"], preferred_name: brandName },
    endpoints: { rest: url ? url + "/api/v1" : "https://api.yourdomain.com/v1" },
    humans: { triggers: ["complaint", "legal_question"], channels: [], handoff_protocol: "transfer_context" },
    metadata: { industry: ind, languages: ["en"], updated: new Date().toISOString() },
  };

  const fs = require("fs");
  fs.writeFileSync(output, JSON.stringify(template, null, 2));
  const capCount = (template.capabilities as unknown[]).length;
  console.log("\n  Created " + output + " with " + capCount + " capabilities for " + ind);
  console.log("  Next: edit the file, then run: npx agentweb validate " + output + "\n");
}

function runValidate(valArgs: string[]) {
  const file = valArgs[0];
  if (!file) { console.log("  Usage: agentweb validate <path>"); return; }
  const fs = require("fs");
  try {
    const json = JSON.parse(fs.readFileSync(file, "utf-8"));
    const required = ["name", "spec_version", "description", "capabilities"];
    const missing = required.filter((k: string) => !json[k]);
    if (missing.length > 0) { console.log("\n  Invalid — missing: " + missing.join(", ") + "\n"); process.exit(1); }
    const warnings: string[] = [];
    if (!json.authentication) warnings.push("No authentication");
    if (!json.policies) warnings.push("No policies");
    if (!json.brand_voice) warnings.push("No brand voice");
    if (!json.endpoints) warnings.push("No endpoints");
    if (!json.humans) warnings.push("No escalation paths");
    console.log("\n  Valid agent.json: " + json.name);
    console.log("  Capabilities: " + (json.capabilities || []).length);
    if (json.endpoints) console.log("  Endpoints: " + Object.keys(json.endpoints).join(", "));
    if (warnings.length > 0) { console.log("  Warnings: " + warnings.join(", ")); }
    console.log("");
  } catch (err) { console.log("  Error: " + err); process.exit(1); }
}

function extractName(url: string): string {
  try {
    const n = new URL(url).hostname.replace("www.", "").split(".")[0] || "My Service";
    return n.charAt(0).toUpperCase() + n.slice(1);
  } catch { return "My Service"; }
}
