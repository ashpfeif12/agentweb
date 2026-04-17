/**
 * agent.json Validator
 *
 * Validates agent.json files against the spec schema.
 * Returns structured validation results with actionable error messages.
 */

import type { AgentManifest } from "./types";

// ─── Validation Result Types ─────────────────────────────────

export type Severity = "error" | "warning" | "info";

export interface ValidationIssue {
  path: string;
  message: string;
  severity: Severity;
  fix?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  manifest: AgentManifest | null;
}

// ─── Core Validator ──────────────────────────────────────────

export function validate(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {
      valid: false,
      issues: [
        {
          path: "$",
          message: "agent.json must be a JSON object",
          severity: "error",
        },
      ],
      manifest: null,
    };
  }

  const obj = input as Record<string, unknown>;

  // Required fields
  validateRequired(obj, issues);

  // Field-level validation
  if (typeof obj.name === "string") {
    validateName(obj.name, issues);
  }
  if (typeof obj.spec_version === "string") {
    validateSpecVersion(obj.spec_version, issues);
  }
  if (typeof obj.version === "string") {
    validateVersion(obj.version, issues);
  }
  if (typeof obj.description === "string") {
    validateDescription(obj.description, issues);
  }
  if (Array.isArray(obj.capabilities)) {
    validateCapabilities(obj.capabilities, issues);
  }
  if (Array.isArray(obj.actions)) {
    validateActions(obj.actions, obj.capabilities as unknown[], issues);
  }
  if (obj.authentication) {
    validateAuthentication(
      obj.authentication as Record<string, unknown>,
      issues
    );
  }
  if (obj.policies) {
    validatePolicies(obj.policies as Record<string, unknown>, issues);
  }
  if (obj.brand_voice) {
    validateBrandVoice(obj.brand_voice as Record<string, unknown>, issues);
  }
  if (obj.endpoints) {
    validateEndpoints(obj.endpoints as Record<string, unknown>, issues);
  }
  if (obj.humans) {
    validateHumanEscalation(obj.humans as Record<string, unknown>, issues);
  }

  // Quality warnings
  addQualityWarnings(obj, issues);

  const hasErrors = issues.some((i) => i.severity === "error");

  return {
    valid: !hasErrors,
    issues,
    manifest: hasErrors ? null : (obj as unknown as AgentManifest),
  };
}

// ─── Field Validators ────────────────────────────────────────

function validateRequired(
  obj: Record<string, unknown>,
  issues: ValidationIssue[]
) {
  const required = ["name", "spec_version", "description", "capabilities"];
  for (const field of required) {
    if (!(field in obj) || obj[field] === undefined || obj[field] === null) {
      issues.push({
        path: `$.${field}`,
        message: `Missing required field: ${field}`,
        severity: "error",
        fix: `Add a "${field}" field to your agent.json`,
      });
    }
  }
}

function validateName(name: string, issues: ValidationIssue[]) {
  if (name.trim().length === 0) {
    issues.push({
      path: "$.name",
      message: "Name cannot be empty",
      severity: "error",
    });
  }
}

function validateSpecVersion(version: string, issues: ValidationIssue[]) {
  if (version !== "1.0") {
    issues.push({
      path: "$.spec_version",
      message: `Unknown spec_version "${version}". Current version is "1.0"`,
      severity: "error",
      fix: 'Set spec_version to "1.0"',
    });
  }
}

function validateVersion(version: string, issues: ValidationIssue[]) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    issues.push({
      path: "$.version",
      message: `Version "${version}" is not valid semver (expected X.Y.Z)`,
      severity: "error",
      fix: 'Use semver format: "1.0.0"',
    });
  }
}

function validateDescription(description: string, issues: ValidationIssue[]) {
  if (description.length > 500) {
    issues.push({
      path: "$.description",
      message: `Description exceeds 500 character limit (${description.length} chars)`,
      severity: "error",
      fix: "Shorten your description to 500 characters or less",
    });
  }
  if (description.length < 20) {
    issues.push({
      path: "$.description",
      message:
        "Description is very short. Agents use this to decide relevance — be specific.",
      severity: "warning",
      fix: "Describe what your service does, what data it offers, and who it serves",
    });
  }
}

function validateCapabilities(caps: unknown[], issues: ValidationIssue[]) {
  if (caps.length === 0) {
    issues.push({
      path: "$.capabilities",
      message: "At least one capability is required",
      severity: "error",
    });
    return;
  }

  const names = new Set<string>();
  const validTypes = ["query", "action", "subscription", "negotiation"];

  caps.forEach((cap, i) => {
    const path = `$.capabilities[${i}]`;
    if (typeof cap !== "object" || cap === null) {
      issues.push({ path, message: "Capability must be an object", severity: "error" });
      return;
    }
    const c = cap as Record<string, unknown>;

    if (typeof c.name !== "string" || !c.name) {
      issues.push({ path: `${path}.name`, message: "Capability must have a name", severity: "error" });
    } else {
      if (!/^[a-z][a-z0-9_]*$/.test(c.name)) {
        issues.push({
          path: `${path}.name`,
          message: `Capability name "${c.name}" must be snake_case (lowercase, underscores)`,
          severity: "error",
          fix: `Rename to "${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}"`,
        });
      }
      if (names.has(c.name as string)) {
        issues.push({
          path: `${path}.name`,
          message: `Duplicate capability name: "${c.name}"`,
          severity: "error",
        });
      }
      names.add(c.name as string);
    }

    if (typeof c.description !== "string" || !c.description) {
      issues.push({
        path: `${path}.description`,
        message: "Capability must have a description",
        severity: "error",
      });
    }

    if (typeof c.type !== "string" || !validTypes.includes(c.type)) {
      issues.push({
        path: `${path}.type`,
        message: `Capability type must be one of: ${validTypes.join(", ")}`,
        severity: "error",
      });
    }
  });
}

function validateActions(
  actions: unknown[],
  capabilities: unknown[],
  issues: ValidationIssue[]
) {
  const capNames = new Set<string>();
  if (Array.isArray(capabilities)) {
    capabilities.forEach((c) => {
      if (typeof c === "object" && c !== null && typeof (c as Record<string, unknown>).name === "string") {
        capNames.add((c as Record<string, unknown>).name as string);
      }
    });
  }

  actions.forEach((action, i) => {
    const path = `$.actions[${i}]`;
    if (typeof action !== "object" || action === null) return;
    const a = action as Record<string, unknown>;

    if (typeof a.name === "string" && !capNames.has(a.name)) {
      issues.push({
        path: `${path}.name`,
        message: `Action "${a.name}" doesn't match any declared capability`,
        severity: "warning",
        fix: `Add a matching capability or rename the action`,
      });
    }

    if (a.destructive === true && a.requires_confirmation !== true) {
      issues.push({
        path: `${path}`,
        message: `Destructive action "${a.name || i}" should require confirmation`,
        severity: "warning",
        fix: "Set requires_confirmation: true for destructive actions",
      });
    }
  });
}

function validateAuthentication(
  auth: Record<string, unknown>,
  issues: ValidationIssue[]
) {
  const validTypes = ["none", "api_key", "oauth2", "bearer", "mcp_auth"];
  if (typeof auth.type !== "string" || !validTypes.includes(auth.type)) {
    issues.push({
      path: "$.authentication.type",
      message: `Authentication type must be one of: ${validTypes.join(", ")}`,
      severity: "error",
    });
  }

  if (auth.type === "oauth2") {
    if (!auth.authorization_url) {
      issues.push({
        path: "$.authentication.authorization_url",
        message: "OAuth2 auth requires an authorization_url",
        severity: "error",
      });
    }
  }
}

function validatePolicies(
  policies: Record<string, unknown>,
  issues: ValidationIssue[]
) {
  if (typeof policies.rate_limit === "string") {
    if (!/^\d+\/(second|minute|hour|day)$/.test(policies.rate_limit)) {
      issues.push({
        path: "$.policies.rate_limit",
        message: `Rate limit "${policies.rate_limit}" should be in format "N/unit" (e.g., "100/minute")`,
        severity: "warning",
      });
    }
  }

  const validDataHandling = [
    "no_restrictions",
    "no_training_on_interactions",
    "no_storage",
    "ephemeral_only",
  ];
  if (
    typeof policies.data_handling === "string" &&
    !validDataHandling.includes(policies.data_handling)
  ) {
    issues.push({
      path: "$.policies.data_handling",
      message: `data_handling must be one of: ${validDataHandling.join(", ")}`,
      severity: "error",
    });
  }
}

function validateBrandVoice(
  bv: Record<string, unknown>,
  issues: ValidationIssue[]
) {
  if (typeof bv.tone === "string" && bv.tone.length > 200) {
    issues.push({
      path: "$.brand_voice.tone",
      message: "Tone description is very long — keep it concise for agent consumption",
      severity: "warning",
    });
  }
}

function validateEndpoints(
  endpoints: Record<string, unknown>,
  issues: ValidationIssue[]
) {
  const urlFields = ["mcp", "rest", "graphql", "nlweb", "a2a", "websocket", "docs"];
  const hasEndpoint = urlFields.some(
    (f) => typeof endpoints[f] === "string" && endpoints[f]
  );

  if (!hasEndpoint) {
    issues.push({
      path: "$.endpoints",
      message: "At least one endpoint should be defined",
      severity: "warning",
      fix: "Add an MCP, REST, or other endpoint URL",
    });
  }

  for (const field of urlFields) {
    if (typeof endpoints[field] === "string" && endpoints[field]) {
      try {
        new URL(endpoints[field] as string);
      } catch {
        issues.push({
          path: `$.endpoints.${field}`,
          message: `Invalid URL: "${endpoints[field]}"`,
          severity: "error",
        });
      }
    }
  }
}

function validateHumanEscalation(
  humans: Record<string, unknown>,
  issues: ValidationIssue[]
) {
  if (Array.isArray(humans.channels)) {
    humans.channels.forEach((ch, i) => {
      if (typeof ch === "object" && ch !== null) {
        const channel = ch as Record<string, unknown>;
        const validTypes = ["chat", "email", "phone", "callback"];
        if (typeof channel.type === "string" && !validTypes.includes(channel.type)) {
          issues.push({
            path: `$.humans.channels[${i}].type`,
            message: `Channel type must be one of: ${validTypes.join(", ")}`,
            severity: "error",
          });
        }
      }
    });
  }
}

// ─── Quality Warnings ────────────────────────────────────────

function addQualityWarnings(
  obj: Record<string, unknown>,
  issues: ValidationIssue[]
) {
  if (!obj.authentication) {
    issues.push({
      path: "$.authentication",
      message: "No authentication defined — agents won't know how to authenticate",
      severity: "info",
      fix: "Add an authentication section, even if it's { type: 'none' }",
    });
  }

  if (!obj.policies) {
    issues.push({
      path: "$.policies",
      message: "No policies defined — agents won't know your rate limits or data rules",
      severity: "warning",
      fix: "Add a policies section with at least rate_limit and data_handling",
    });
  }

  if (!obj.brand_voice) {
    issues.push({
      path: "$.brand_voice",
      message: "No brand voice defined — agents will use their own judgment when representing your brand",
      severity: "info",
      fix: "Add brand_voice to control how agents talk about you",
    });
  }

  if (!obj.endpoints) {
    issues.push({
      path: "$.endpoints",
      message: "No endpoints defined — agents can read about you but can't connect",
      severity: "warning",
      fix: "Add at least one endpoint (MCP, REST, GraphQL)",
    });
  }

  if (!obj.humans) {
    issues.push({
      path: "$.humans",
      message: "No human escalation paths — agents can't hand off complex interactions",
      severity: "info",
      fix: "Add a humans section with escalation triggers and support channels",
    });
  }

  if (!obj.version) {
    issues.push({
      path: "$.version",
      message: "No version set — agents can't detect when your capabilities change",
      severity: "info",
      fix: 'Add version: "1.0.0" and increment it when you update capabilities',
    });
  }

  // Check for actions without schemas
  if (Array.isArray(obj.actions)) {
    (obj.actions as Record<string, unknown>[]).forEach((action, i) => {
      if (!action.input_schema) {
        issues.push({
          path: `$.actions[${i}].input_schema`,
          message: `Action "${action.name || i}" has no input schema — agents won't know what parameters to send`,
          severity: "warning",
          fix: "Add an input_schema with JSON Schema defining expected parameters",
        });
      }
      if (!action.output_schema) {
        issues.push({
          path: `$.actions[${i}].output_schema`,
          message: `Action "${action.name || i}" has no output schema — agents won't know what to expect back`,
          severity: "info",
        });
      }
    });
  }
}

// ─── Utilities ───────────────────────────────────────────────

export function formatIssues(issues: ValidationIssue[]): string {
  const grouped = {
    error: issues.filter((i) => i.severity === "error"),
    warning: issues.filter((i) => i.severity === "warning"),
    info: issues.filter((i) => i.severity === "info"),
  };

  const lines: string[] = [];

  if (grouped.error.length > 0) {
    lines.push(`\n  ✗ ${grouped.error.length} error(s):`);
    grouped.error.forEach((i) => {
      lines.push(`    ${i.path}: ${i.message}`);
      if (i.fix) lines.push(`      → Fix: ${i.fix}`);
    });
  }

  if (grouped.warning.length > 0) {
    lines.push(`\n  ⚠ ${grouped.warning.length} warning(s):`);
    grouped.warning.forEach((i) => {
      lines.push(`    ${i.path}: ${i.message}`);
      if (i.fix) lines.push(`      → Fix: ${i.fix}`);
    });
  }

  if (grouped.info.length > 0) {
    lines.push(`\n  ℹ ${grouped.info.length} suggestion(s):`);
    grouped.info.forEach((i) => {
      lines.push(`    ${i.path}: ${i.message}`);
      if (i.fix) lines.push(`      → Fix: ${i.fix}`);
    });
  }

  return lines.join("\n");
}
