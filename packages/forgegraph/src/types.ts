export type ForgeGraphRollbackEnvironment =
  | "dev"
  | "staging"
  | "production"
  | "preview"
  | "prod";

export interface ForgeGraphRollbackPayload {
  source: "control-plane" | "alertmanager";
  repoId?: string;
  repoName?: string;
  workspaceId?: string;
  environment: ForgeGraphRollbackEnvironment;
  sourceDeploymentId?: string;
  sourceRevision?: string;
  rollbackDeploymentId?: string;
  rollbackImageTag?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface ForgeGraphControlPlaneClientConfig {
  baseUrl: string;
  token: string;
  endpointPath: string;
  requestTimeoutMs: number;
}

export interface ForgeGraphControlPlaneResponse {
  statusCode: number;
  body: unknown;
}

export type RollbackSeverity = "critical" | "warning" | "info";

export type RollbackPolicyEnvironment =
  | "production"
  | "staging"
  | "dev"
  | "preview"
  | "development";

export interface ParsedRollbackPolicy {
  enabled: boolean;
  severities: RollbackSeverity[];
  environments: RollbackPolicyEnvironment[];
  dedupeWindowMs: number;
  dryRun: boolean;
}

export interface RollbackDecision {
  alertName: string;
  action:
    | "skipped"
    | "deduped"
    | "no-target"
    | "disabled"
    | "failed"
    | "triggered"
    | "dry-run";
  reason: string;
  response?: unknown;
}

export class ForgeGraphClientError extends Error {
  constructor(
    message: string,
    public statusCode: number = 502,
    public service: string = "ForgeGraph",
  ) {
    super(message);
    this.name = "ForgeGraphClientError";
  }
}
