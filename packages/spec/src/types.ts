/**
 * agent.json TypeScript Type Definitions
 * Agent-Ready Syndication (ARS) Manifest v1.0
 *
 * These types match the JSON Schema in agent.schema.json.
 * Use them to validate and work with agent.json files programmatically.
 */

// ─── Core Types ──────────────────────────────────────────────

export interface AgentManifest {
  /** Human-readable name of the service or brand */
  name: string;

  /** Version of this agent.json file (semver) */
  version?: string;

  /** Spec version this file conforms to */
  spec_version: "1.0";

  /** Natural-language summary for agent decision-making (max 500 chars) */
  description: string;

  /** What an agent can do with this service */
  capabilities: Capability[];

  /** Detailed action definitions with I/O schemas */
  actions?: Action[];

  /** Structured data types this service exposes */
  data_schemas?: DataSchema[];

  /** How agents authenticate */
  authentication?: Authentication;

  /** Rate limits, data handling, business rules */
  policies?: Policies;

  /** How agents should represent this brand */
  brand_voice?: BrandVoice;

  /** Protocol-specific connection endpoints */
  endpoints?: Endpoints;

  /** When/how to escalate to humans */
  humans?: HumanEscalation;

  /** NLWeb protocol compatibility */
  nlweb?: NLWebCompat;

  /** Additional metadata */
  metadata?: Metadata;
}

// ─── Capabilities ────────────────────────────────────────────

export type CapabilityType = "query" | "action" | "subscription" | "negotiation";

export interface Capability {
  /** Machine-readable identifier (snake_case) */
  name: string;

  /** What this capability does — agents use this for decision-making */
  description: string;

  /** query = read-only, action = state-changing, subscription = real-time, negotiation = multi-turn */
  type: CapabilityType;

  /** Whether this capability requires authentication */
  requires_auth?: boolean;

  /** Freeform tags for categorization */
  tags?: string[];
}

// ─── Actions ─────────────────────────────────────────────────

export interface Action {
  /** Machine-readable identifier, should match a capability name */
  name: string;

  /** Natural-language description */
  description: string;

  /** JSON Schema for expected input */
  input_schema?: Record<string, unknown>;

  /** JSON Schema for response structure */
  output_schema?: Record<string, unknown>;

  /** Safe to call multiple times with same input? */
  idempotent?: boolean;

  /** Makes irreversible changes? */
  destructive?: boolean;

  /** Should agent confirm with user first? */
  requires_confirmation?: boolean;

  /** Action-specific rate limit (overrides global) */
  rate_limit?: string;

  /** Example invocations */
  examples?: ActionExample[];
}

export interface ActionExample {
  description?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
}

// ─── Data Schemas ────────────────────────────────────────────

export interface DataSchema {
  /** Schema name (e.g., 'Product', 'Order') */
  name: string;

  /** Description of this data type */
  description?: string;

  /** JSON Schema definition */
  schema: Record<string, unknown>;

  /** Corresponding Schema.org type */
  schema_org_type?: string;
}

// ─── Authentication ──────────────────────────────────────────

export type AuthType = "none" | "api_key" | "oauth2" | "bearer" | "mcp_auth";

export interface Authentication {
  type: AuthType;
  authorization_url?: string;
  token_url?: string;
  scopes?: string[];
  registration_url?: string;
  docs_url?: string;
}

// ─── Policies ────────────────────────────────────────────────

export type DataHandling =
  | "no_restrictions"
  | "no_training_on_interactions"
  | "no_storage"
  | "ephemeral_only";

export interface Policies {
  /** Global rate limit (e.g., "100/minute") */
  rate_limit?: string;

  /** How agent platforms should handle interaction data */
  data_handling?: DataHandling;

  /** Link to full ToS */
  terms_url?: string;

  /** Allowlist of agent platforms (empty = all) */
  allowed_agents?: string[];

  /** Blocklist of agent platforms */
  blocked_agents?: string[];

  /** Domain-specific business rules */
  business_policies?: BusinessPolicies;
}

export interface BusinessPolicies {
  returns?: string;
  shipping?: string;
  price_matching?: string;
  warranty?: string;
  [key: string]: string | undefined;
}

// ─── Brand Voice ─────────────────────────────────────────────

export interface BrandVoice {
  /** Comma-separated tone descriptors */
  tone?: string;

  /** Topics/claims agents should avoid */
  prohibited?: string[];

  /** Required legal/regulatory statements */
  required_disclosures?: string[];

  /** How the brand should be referred to */
  preferred_name?: string;

  /** Link to full brand guidelines */
  messaging_guidelines_url?: string;
}

// ─── Endpoints ───────────────────────────────────────────────

export interface Endpoints {
  /** MCP server (SSE or streamable HTTP) */
  mcp?: string;

  /** REST API base URL */
  rest?: string;

  /** GraphQL endpoint */
  graphql?: string;

  /** NLWeb endpoint */
  nlweb?: string;

  /** Google A2A protocol endpoint */
  a2a?: string;

  /** WebSocket for real-time communication */
  websocket?: string;

  /** Developer documentation */
  docs?: string;
}

// ─── Human Escalation ────────────────────────────────────────

export type EscalationChannel = "chat" | "email" | "phone" | "callback";
export type HandoffProtocol = "transfer_context" | "restart" | "email_summary";

export interface HumanEscalation {
  /** Conditions that trigger human escalation */
  triggers?: string[];

  /** Available human support channels */
  channels?: Array<{
    type: EscalationChannel;
    url?: string;
    hours?: string;
  }>;

  /** How context transfers from agent to human */
  handoff_protocol?: HandoffProtocol;
}

// ─── NLWeb Compatibility ─────────────────────────────────────

export interface NLWebCompat {
  endpoint?: string;
  schema_types?: string[];
  ask_endpoint?: string;
}

// ─── Metadata ────────────────────────────────────────────────

export type Industry =
  | "retail"
  | "hospitality"
  | "healthcare"
  | "finance"
  | "media"
  | "education"
  | "real_estate"
  | "food_service"
  | "travel"
  | "technology"
  | "government"
  | "other";

export interface Metadata {
  industry?: Industry;
  regions?: string[];
  languages?: string[];
  updated?: string;
}
