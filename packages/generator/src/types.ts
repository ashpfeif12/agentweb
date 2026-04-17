/**
 * MCP Server Generator — Core Types
 *
 * The generator uses a pipeline architecture:
 * Input Parser → Capability Mapper → Tool Generator → Server Builder → Packager
 *
 * These types define the intermediate representations shared between stages.
 */

// ─── Input Types ─────────────────────────────────────────────

export type InputType = "openapi" | "graphql" | "website" | "agent_json";

export interface GeneratorConfig {
  /** Input source — file path or URL */
  from: string;

  /** Detected or specified input type */
  inputType: InputType;

  /** Output directory */
  output: string;

  /** Service name (auto-detected if omitted) */
  name?: string;

  /** MCP transport type */
  transport: "sse" | "streamable-http" | "stdio";

  /** Output language */
  language: "typescript" | "python";

  /** Whether to generate Dockerfile */
  docker: boolean;

  /** Whether to generate tests */
  tests: boolean;

  /** Optional deployment target */
  deploy?: string;
}

// ─── Capability Map (Intermediate Representation) ────────────

/**
 * The CapabilityMap is the universal intermediate format.
 * All input parsers produce this; all output generators consume it.
 */
export interface CapabilityMap {
  /** Service metadata */
  service: ServiceInfo;

  /** Discovered capabilities (endpoints/operations → tools) */
  tools: ToolDefinition[];

  /** Authentication requirements */
  auth: AuthConfig;

  /** Discovered data types */
  types: TypeDefinition[];
}

export interface ServiceInfo {
  name: string;
  description: string;
  baseUrl: string;
  version?: string;
}

export interface ToolDefinition {
  /** Tool name (snake_case, will be used as MCP tool name) */
  name: string;

  /** Human-readable description */
  description: string;

  /** Source HTTP method and path (for API-derived tools) */
  source?: {
    method: string;
    path: string;
  };

  /** Input parameters */
  parameters: ParameterDefinition[];

  /** Response schema */
  responseSchema?: Record<string, unknown>;

  /** MCP annotations */
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  };

  /** Rate limit for this specific tool */
  rateLimit?: string;

  /** Tags for categorization */
  tags: string[];
}

export interface ParameterDefinition {
  name: string;
  description: string;
  type: string;
  required: boolean;
  location: "path" | "query" | "body" | "header";
  schema?: Record<string, unknown>;
  default?: unknown;
  enum?: unknown[];
}

export interface AuthConfig {
  type: "none" | "api_key" | "bearer" | "oauth2";
  headerName?: string;
  queryParamName?: string;
  oauth2?: {
    authorizationUrl: string;
    tokenUrl: string;
    scopes: string[];
  };
}

export interface TypeDefinition {
  name: string;
  description?: string;
  properties: Record<
    string,
    {
      type: string;
      description?: string;
      required?: boolean;
    }
  >;
}

// ─── Pipeline Stage Interfaces ───────────────────────────────

export interface InputParser {
  /** Detect if this parser can handle the input */
  canParse(from: string): Promise<boolean>;

  /** Parse the input into a CapabilityMap */
  parse(from: string, config: GeneratorConfig): Promise<CapabilityMap>;
}

export interface ToolGenerator {
  /** Generate tool implementation code */
  generateTool(tool: ToolDefinition, config: GeneratorConfig): string;

  /** Generate the server entry point */
  generateServer(map: CapabilityMap, config: GeneratorConfig): string;

  /** Generate auth middleware */
  generateAuth(auth: AuthConfig, config: GeneratorConfig): string;

  /** Generate type definitions */
  generateTypes(types: TypeDefinition[], config: GeneratorConfig): string;
}

export interface Packager {
  /** Generate Dockerfile */
  generateDockerfile(config: GeneratorConfig): string;

  /** Generate agent.json from CapabilityMap */
  generateAgentJson(map: CapabilityMap): Record<string, unknown>;

  /** Generate README */
  generateReadme(map: CapabilityMap, config: GeneratorConfig): string;

  /** Generate test file */
  generateTests(
    map: CapabilityMap,
    config: GeneratorConfig
  ): string;

  /** Generate package.json */
  generatePackageJson(map: CapabilityMap, config: GeneratorConfig): Record<string, unknown>;
}

// ─── HTTP Method → Annotation Mapping ────────────────────────

export function annotationsFromMethod(method: string): ToolDefinition["annotations"] {
  const m = method.toUpperCase();
  return {
    readOnlyHint: m === "GET" || m === "HEAD" || m === "OPTIONS",
    destructiveHint: m === "DELETE",
    idempotentHint: m === "GET" || m === "PUT" || m === "DELETE",
    openWorldHint: false,
  };
}

// ─── Tool Name Generation ────────────────────────────────────

export function generateToolName(method: string, path: string): string {
  // GET /users → list_users
  // GET /users/{id} → get_user
  // POST /users → create_user
  // PUT /users/{id} → update_user
  // DELETE /users/{id} → delete_user
  // GET /users/{id}/orders → list_user_orders

  const methodPrefix: Record<string, string> = {
    GET: "list",
    POST: "create",
    PUT: "update",
    PATCH: "update",
    DELETE: "delete",
  };

  const segments = path
    .split("/")
    .filter((s) => s && !s.startsWith("{"));

  const hasIdParam = path.includes("{");
  const prefix =
    method.toUpperCase() === "GET" && hasIdParam
      ? "get"
      : methodPrefix[method.toUpperCase()] || method.toLowerCase();

  const resource = segments
    .map((s) => s.replace(/[^a-zA-Z0-9]/g, "_"))
    .join("_");

  // Singularize for single-resource operations
  let name = `${prefix}_${resource}`;
  if (hasIdParam && name.endsWith("s") && prefix !== "list") {
    name = name.slice(0, -1);
  }

  return name.toLowerCase().replace(/_+/g, "_").replace(/^_|_$/g, "");
}
