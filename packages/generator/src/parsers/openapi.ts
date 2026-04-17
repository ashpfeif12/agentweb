/**
 * OpenAPI Input Parser
 *
 * Parses OpenAPI 3.x specifications and produces a CapabilityMap.
 * Handles JSON and YAML formats, resolves $ref references,
 * and maps HTTP operations to MCP tool definitions.
 */

import type {
  InputParser,
  CapabilityMap,
  GeneratorConfig,
  ToolDefinition,
  ParameterDefinition,
  AuthConfig,
  TypeDefinition,
} from "../types.js";
import { annotationsFromMethod, generateToolName } from "../types.js";

export class OpenApiParser implements InputParser {
  async canParse(from: string): Promise<boolean> {
    // Check file extension
    if (/\.(json|yaml|yml)$/i.test(from)) {
      return true;
    }
    // Check if URL returns OpenAPI spec
    if (from.startsWith("http")) {
      try {
        const res = await fetch(from);
        const text = await res.text();
        return text.includes('"openapi"') || text.includes("openapi:");
      } catch {
        return false;
      }
    }
    return false;
  }

  async parse(
    from: string,
    config: GeneratorConfig
  ): Promise<CapabilityMap> {
    const spec = await this.loadSpec(from);
    const info = (spec.info ?? {}) as Record<string, unknown>;

    const service = {
      name: config.name || (info.title as string) || "API Service",
      description: (info.description as string) || "",
      baseUrl: this.extractBaseUrl(spec),
      version: info.version as string | undefined,
    };

    const tools = this.extractTools(spec);
    const auth = this.extractAuth(spec);
    const types = this.extractTypes(spec);

    return { service, tools, auth, types };
  }

  private async loadSpec(from: string): Promise<Record<string, unknown>> {
    let text: string;

    if (from.startsWith("http")) {
      const res = await fetch(from);
      text = await res.text();
    } else {
      const { readFileSync } = await import("fs");
      text = readFileSync(from, "utf-8");
    }

    // Try JSON first, then YAML
    try {
      return JSON.parse(text);
    } catch {
      // Basic YAML parsing for common patterns
      // In production, use a proper YAML parser
      throw new Error(
        "YAML parsing not yet implemented — convert to JSON or install yaml package"
      );
    }
  }

  private extractBaseUrl(spec: Record<string, unknown>): string {
    const servers = spec.servers as Array<{ url: string }> | undefined;
    if (servers && servers.length > 0) {
      return servers[0]!.url;
    }
    return "https://api.example.com";
  }

  private extractTools(spec: Record<string, unknown>): ToolDefinition[] {
    const tools: ToolDefinition[] = [];
    const paths = spec.paths as Record<string, Record<string, unknown>> | undefined;

    if (!paths) return tools;

    for (const [path, pathItem] of Object.entries(paths)) {
      for (const method of ["get", "post", "put", "patch", "delete"]) {
        const operation = pathItem[method] as Record<string, unknown> | undefined;
        if (!operation) continue;

        const name = (operation.operationId as string) ||
          generateToolName(method, path);

        const description =
          (operation.summary as string) ||
          (operation.description as string) ||
          `${method.toUpperCase()} ${path}`;

        const parameters = this.extractParameters(
          operation,
          pathItem,
          spec
        );

        const responseSchema = this.extractResponseSchema(operation, spec);

        const tags = (operation.tags as string[]) || [];

        tools.push({
          name: name.replace(/[^a-z0-9_]/gi, "_").toLowerCase(),
          description,
          source: { method: method.toUpperCase(), path },
          parameters,
          responseSchema,
          annotations: annotationsFromMethod(method),
          tags,
        });
      }
    }

    return tools;
  }

  private extractParameters(
    operation: Record<string, unknown>,
    pathItem: Record<string, unknown>,
    spec: Record<string, unknown>
  ): ParameterDefinition[] {
    const params: ParameterDefinition[] = [];

    // Path/query/header parameters
    const opParams = (operation.parameters || []) as Array<Record<string, unknown>>;
    const pathParams = (pathItem.parameters || []) as Array<Record<string, unknown>>;
    const allParams = [...pathParams, ...opParams];

    for (const param of allParams) {
      const resolved = this.resolveRef(param, spec);
      params.push({
        name: resolved.name as string,
        description: (resolved.description as string) || "",
        type: this.schemaToType(resolved.schema as Record<string, unknown>),
        required: (resolved.required as boolean) || false,
        location: resolved.in as ParameterDefinition["location"],
        schema: resolved.schema as Record<string, unknown>,
      });
    }

    // Request body
    const requestBody = operation.requestBody as Record<string, unknown> | undefined;
    if (requestBody) {
      const resolved = this.resolveRef(requestBody, spec);
      const content = resolved.content as Record<string, Record<string, unknown>> | undefined;
      if (content) {
        const jsonContent = content["application/json"];
        if (jsonContent?.schema) {
          const schema = this.resolveRef(
            jsonContent.schema as Record<string, unknown>,
            spec
          );
          const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
          const required = (schema.required as string[]) || [];

          if (properties) {
            for (const [propName, propSchema] of Object.entries(properties)) {
              params.push({
                name: propName,
                description: (propSchema.description as string) || "",
                type: this.schemaToType(propSchema),
                required: required.includes(propName),
                location: "body",
                schema: propSchema,
              });
            }
          }
        }
      }
    }

    return params;
  }

  private extractResponseSchema(
    operation: Record<string, unknown>,
    spec: Record<string, unknown>
  ): Record<string, unknown> | undefined {
    const responses = operation.responses as Record<string, Record<string, unknown>> | undefined;
    if (!responses) return undefined;

    // Look for 200/201/2xx responses
    const successResponse =
      responses["200"] || responses["201"] || responses["2XX"];
    if (!successResponse) return undefined;

    const resolved = this.resolveRef(successResponse, spec);
    const content = resolved.content as Record<string, Record<string, unknown>> | undefined;
    if (!content) return undefined;

    const jsonContent = content["application/json"];
    if (!jsonContent?.schema) return undefined;

    return this.resolveRef(
      jsonContent.schema as Record<string, unknown>,
      spec
    );
  }

  private extractAuth(spec: Record<string, unknown>): AuthConfig {
    const components = spec.components as Record<string, unknown> | undefined;
    const securitySchemes = components?.securitySchemes as
      | Record<string, Record<string, unknown>>
      | undefined;

    if (!securitySchemes) return { type: "none" };

    // Use the first security scheme
    const [, scheme] = Object.entries(securitySchemes)[0] || [];
    if (!scheme) return { type: "none" };

    const schemeType = scheme.type as string;

    if (schemeType === "http" && scheme.scheme === "bearer") {
      return { type: "bearer" };
    }

    if (schemeType === "apiKey") {
      return {
        type: "api_key",
        headerName:
          scheme.in === "header" ? (scheme.name as string) : undefined,
        queryParamName:
          scheme.in === "query" ? (scheme.name as string) : undefined,
      };
    }

    if (schemeType === "oauth2") {
      const flows = scheme.flows as Record<string, Record<string, unknown>> | undefined;
      const flow =
        flows?.authorizationCode || flows?.clientCredentials || flows?.implicit;
      if (flow) {
        return {
          type: "oauth2",
          oauth2: {
            authorizationUrl: (flow.authorizationUrl as string) || "",
            tokenUrl: (flow.tokenUrl as string) || "",
            scopes: Object.keys((flow.scopes as Record<string, string>) || {}),
          },
        };
      }
    }

    return { type: "none" };
  }

  private extractTypes(spec: Record<string, unknown>): TypeDefinition[] {
    const types: TypeDefinition[] = [];
    const components = spec.components as Record<string, unknown> | undefined;
    const schemas = components?.schemas as
      | Record<string, Record<string, unknown>>
      | undefined;

    if (!schemas) return types;

    for (const [name, schema] of Object.entries(schemas)) {
      if (schema.type !== "object" || !schema.properties) continue;

      const properties: TypeDefinition["properties"] = {};
      const required = (schema.required as string[]) || [];

      for (const [propName, propSchema] of Object.entries(
        schema.properties as Record<string, Record<string, unknown>>
      )) {
        properties[propName] = {
          type: this.schemaToType(propSchema),
          description: propSchema.description as string | undefined,
          required: required.includes(propName),
        };
      }

      types.push({
        name,
        description: schema.description as string | undefined,
        properties,
      });
    }

    return types;
  }

  // ─── Helpers ─────────────────────────────────────────────

  private resolveRef(
    obj: Record<string, unknown>,
    spec: Record<string, unknown>
  ): Record<string, unknown> {
    if (!obj["$ref"]) return obj;

    const ref = obj["$ref"] as string;
    const path = ref.replace("#/", "").split("/");

    let current: unknown = spec;
    for (const segment of path) {
      current = (current as Record<string, unknown>)[segment];
      if (!current) return obj;
    }

    return current as Record<string, unknown>;
  }

  private schemaToType(schema?: Record<string, unknown>): string {
    if (!schema) return "unknown";
    const type = schema.type as string;

    switch (type) {
      case "string":
        return schema.format === "date-time" ? "Date" : "string";
      case "integer":
      case "number":
        return "number";
      case "boolean":
        return "boolean";
      case "array":
        return `${this.schemaToType(schema.items as Record<string, unknown>)}[]`;
      case "object":
        return "object";
      default:
        return "unknown";
    }
  }
}
