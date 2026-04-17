export type {
  AgentManifest,
  Capability,
  CapabilityType,
  Action,
  ActionExample,
  DataSchema,
  Authentication,
  AuthType,
  Policies,
  DataHandling,
  BusinessPolicies,
  BrandVoice,
  Endpoints,
  HumanEscalation,
  EscalationChannel,
  HandoffProtocol,
  NLWebCompat,
  Metadata,
  Industry,
} from "./types.js";

export {
  validate,
  formatIssues,
  type ValidationResult,
  type ValidationIssue,
  type Severity,
} from "./validator.js";
