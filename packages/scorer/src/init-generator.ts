/**
 * agent.json Init Generator
 *
 * Generates a starter agent.json file from:
 * 1. A URL (crawls the site and infers capabilities)
 * 2. An existing OpenAPI spec
 * 3. Interactive prompts
 */

import type { SiteData } from "./scorer.js";

export interface InitOptions {
  url?: string;
  name?: string;
  industry?: string;
  output?: string;
}

export function generateStarterAgentJson(
  data: SiteData,
  options: InitOptions
): Record<string, unknown> {
  const name = options.name || extractBrandName(data.url);
  const industry = options.industry || inferIndustry(data);
  const capabilities = inferCapabilities(data, industry);
  const endpoints = inferEndpoints(data);

  return {
    name,
    version: "1.0.0",
    spec_version: "1.0",
    description: buildDescription(name, data, industry),
    capabilities,
    authentication: { type: "none" },
    policies: {
      rate_limit: "100/minute",
      data_handling: "no_training_on_interactions",
      business_policies: generateBusinessPolicies(industry),
    },
    brand_voice: {
      tone: generateTone(industry),
      prohibited: generateProhibited(industry),
      preferred_name: name,
    },
    endpoints: Object.fromEntries(endpoints),
    humans: {
      triggers: generateEscalationTriggers(industry),
      channels: [],
      handoff_protocol: "transfer_context",
    },
    metadata: {
      industry: industry || "other",
      languages: ["en"],
      updated: new Date().toISOString(),
    },
  };
}

function extractBrandName(url: string): string {
  try {
    const host = new URL(url).hostname.replace("www.", "");
    const name = host.split(".")[0] || "My Service";
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch { return "My Service"; }
}

function inferIndustry(data: SiteData): string {
  const types = data.schemaOrgTypes.map(t => t.toLowerCase());
  if (types.some(t => ["product", "offer"].includes(t))) return "retail";
  if (types.some(t => ["restaurant", "foodestablishment"].includes(t))) return "food_service";
  if (types.some(t => ["lodgingbusiness", "hotel"].includes(t))) return "hospitality";
  if (types.some(t => ["medicalorganization", "physician"].includes(t))) return "healthcare";
  if (types.some(t => ["newsarticle", "article"].includes(t))) return "media";
  if (data.hasOpenApi || data.hasGraphQL) return "technology";
  return "other";
}

function inferCapabilities(data: SiteData, industry: string): Array<Record<string, unknown>> {
  const caps: Array<Record<string, unknown>> = [];
  if (data.hasSchemaOrg || data.hasStructuredData) {
    caps.push({ name: "search_content", description: "Search and browse content", type: "query", tags: ["search"] });
  }
  switch (industry) {
    case "retail":
      caps.push(
        { name: "search_products", description: "Find products by category, price, or query", type: "query", tags: ["catalog"] },
        { name: "check_availability", description: "Check inventory for a product", type: "query", tags: ["inventory"] },
        { name: "place_order", description: "Complete a purchase", type: "action", requires_auth: true, tags: ["commerce"] },
      ); break;
    case "food_service":
      caps.push(
        { name: "view_menu", description: "Browse menu with prices and dietary info", type: "query", tags: ["menu"] },
        { name: "make_reservation", description: "Book a table", type: "action", tags: ["booking"] },
      ); break;
    case "hospitality":
      caps.push(
        { name: "search_rooms", description: "Search available rooms", type: "query", tags: ["rooms"] },
        { name: "book_room", description: "Reserve a room", type: "action", requires_auth: true, tags: ["booking"] },
      ); break;
    case "healthcare":
      caps.push(
        { name: "find_provider", description: "Search providers by specialty", type: "query", tags: ["providers"] },
        { name: "book_appointment", description: "Schedule an appointment", type: "action", requires_auth: true, tags: ["scheduling"] },
      ); break;
    default:
      caps.push({ name: "get_info", description: "Get information about this service", type: "query", tags: ["info"] });
  }
  return caps;
}

function inferEndpoints(data: SiteData): Array<[string, string]> {
  const ep: Array<[string, string]> = [];
  if (data.hasMcpEndpoint) ep.push(["mcp", data.url + "/mcp/sse"]);
  if (data.hasRestApi) ep.push(["rest", data.url + "/api/v1"]);
  if (data.hasGraphQL) ep.push(["graphql", data.url + "/graphql"]);
  ep.push(["docs", data.url + "/developers"]);
  return ep;
}

function buildDescription(name: string, data: SiteData, industry: string): string {
  return name + " — [Edit this to describe what agents can do here]";
}

function generateBusinessPolicies(industry: string): Record<string, string> {
  switch (industry) {
    case "retail": return { returns: "[Your return policy]", shipping: "[Your shipping options]" };
    case "food_service": return { cancellation: "[Your cancellation policy]" };
    case "healthcare": return { hipaa: "All agent interactions must comply with HIPAA." };
    default: return {};
  }
}

function generateTone(industry: string): string {
  const tones: Record<string, string> = {
    retail: "friendly, helpful, never pushy.",
    food_service: "warm, casual, passionate about food.",
    hospitality: "welcoming, professional.",
    healthcare: "caring, professional, clear.",
    technology: "technical, precise, helpful.",
    media: "informative, balanced.",
  };
  return tones[industry] || "professional, helpful, accurate.";
}

function generateProhibited(industry: string): string[] {
  const base = ["competitor disparagement", "unauthorized discounts"];
  if (industry === "healthcare") return [...base, "medical diagnoses", "treatment guarantees"];
  if (industry === "finance") return [...base, "guaranteed returns", "investment advice"];
  return base;
}

function generateEscalationTriggers(industry: string): string[] {
  const base = ["complaint", "legal_question"];
  if (industry === "retail") return [...base, "order_value_over_500", "return_dispute"];
  if (industry === "healthcare") return [...base, "medical_emergency", "patient_distress"];
  return base;
}

export function formatAgentJson(json: Record<string, unknown>): string {
  return JSON.stringify(json, null, 2);
}
