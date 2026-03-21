import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";

const execFile = promisify(execFileCb);

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class GitOpsError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GitOpsError";
  }
}

export class GitOpsConflictError extends GitOpsError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "GitOpsConflictError";
  }
}

export class GitOpsAuthError extends GitOpsError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "GitOpsAuthError";
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeploymentOpts {
  appName: string;
  environment: string;
  imageRepository: string;
  imageTag: string;
  imageDigest?: string;
  commitMessage: string;
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function getRepoUrl(): string {
  const url = process.env.GITOPS_REPO_URL;
  if (!url) throw new GitOpsError("GITOPS_REPO_URL is not set");
  return url;
}

function getLocalPath(): string {
  return process.env.GITOPS_LOCAL_PATH ?? "/tmp/gitops-checkout";
}

function buildGitEnv(): Record<string, string> {
  const env: Record<string, string> = { ...process.env } as Record<
    string,
    string
  >;

  const sshKeyPath = process.env.GITOPS_SSH_KEY_PATH;
  if (sshKeyPath) {
    env.GIT_SSH_COMMAND = `ssh -i ${sshKeyPath} -o StrictHostKeyChecking=no`;
  }

  const token = process.env.GITOPS_TOKEN;
  if (token) {
    // For token-based HTTPS auth, configure credential helper
    env.GIT_ASKPASS = "echo";
    env.GIT_TERMINAL_PROMPT = "0";
  }

  return env;
}

function repoUrlWithToken(url: string): string {
  const token = process.env.GITOPS_TOKEN;
  if (!token || !url.startsWith("https://")) return url;

  // Inject token into HTTPS URL: https://token@host/path
  const parsed = new URL(url);
  parsed.username = token;
  return parsed.toString();
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

async function git(
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string }> {
  const env = buildGitEnv();
  console.log(JSON.stringify({ op: "git", args, cwd }));
  try {
    return await execFile("git", args, { cwd, env });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes("Authentication failed") ||
      msg.includes("Permission denied") ||
      msg.includes("could not read Username")
    ) {
      throw new GitOpsAuthError(`Git authentication failed: ${msg}`, err);
    }
    throw new GitOpsError(`Git command failed: git ${args.join(" ")}: ${msg}`, err);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Clone the GitOps repo if it doesn't exist locally, or fetch latest if it does.
 */
export async function initGitOpsRepo(
  repoUrl?: string,
  localPath?: string,
): Promise<void> {
  const url = repoUrl ?? getRepoUrl();
  const path = localPath ?? getLocalPath();

  if (existsSync(join(path, ".git"))) {
    console.log(JSON.stringify({ op: "initGitOpsRepo", action: "fetch", path }));
    await git(["fetch", "origin"], path);
    await git(["reset", "--hard", "origin/main"], path);
  } else {
    console.log(
      JSON.stringify({ op: "initGitOpsRepo", action: "clone", url, path }),
    );
    await mkdir(dirname(path), { recursive: true });
    await execFile("git", ["clone", repoUrlWithToken(url), path], {
      env: buildGitEnv(),
    });
  }
}

/**
 * Build the YAML content for a deployment values file.
 */
function buildValuesYaml(opts: DeploymentOpts): string {
  const lines = [
    "image:",
    `  repository: ${opts.imageRepository}`,
    `  tag: "${opts.imageTag}"`,
  ];
  if (opts.imageDigest) {
    lines.push(`  digest: "${opts.imageDigest}"`);
  }
  lines.push(""); // trailing newline
  return lines.join("\n");
}

/**
 * Write a deployment values file, commit, and push with conflict retry.
 */
export async function commitDeployment(opts: DeploymentOpts): Promise<string> {
  return commitWithRetry(opts, opts.commitMessage);
}

/**
 * Write a rollback values file, commit, and push with conflict retry.
 */
export async function commitRollback(opts: DeploymentOpts): Promise<string> {
  const message = `rollback: ${opts.commitMessage}`;
  return commitWithRetry(opts, message);
}

const MAX_RETRIES = 3;

async function commitWithRetry(
  opts: DeploymentOpts,
  message: string,
): Promise<string> {
  const localPath = getLocalPath();
  const valuesPath = join(
    "apps",
    opts.appName,
    opts.environment,
    "values.yaml",
  );
  const fullPath = join(localPath, valuesPath);

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(
      JSON.stringify({ op: "commitWithRetry", attempt, appName: opts.appName }),
    );

    // Ensure we're up to date
    if (attempt > 1) {
      await git(["fetch", "origin"], localPath);
      await git(["reset", "--hard", "origin/main"], localPath);
    }

    // Write the values file
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buildValuesYaml(opts), "utf-8");

    // Stage, commit
    await git(["add", valuesPath], localPath);
    await git(
      ["commit", "-m", message, "--author", "control-panel <control-panel@forgegraph.dev>"],
      localPath,
    );

    // Push
    try {
      await git(["push", "origin", "main"], localPath);
      // Success — return the commit SHA
      const { stdout } = await git(["rev-parse", "HEAD"], localPath);
      const sha = stdout.trim();
      console.log(JSON.stringify({ op: "commitWithRetry", result: "success", sha }));
      return sha;
    } catch (err: unknown) {
      lastError = err;
      console.log(
        JSON.stringify({
          op: "commitWithRetry",
          result: "push_failed",
          attempt,
          error: err instanceof Error ? err.message : String(err),
        }),
      );

      if (err instanceof GitOpsAuthError) throw err;

      // Reset for next attempt
      if (attempt < MAX_RETRIES) {
        await git(["fetch", "origin"], localPath);
        await git(["reset", "--hard", "origin/main"], localPath);
      }
    }
  }

  throw new GitOpsConflictError(
    `Failed to push after ${MAX_RETRIES} attempts`,
    lastError,
  );
}

/**
 * Read the current values.yaml for an app/environment, if it exists.
 */
export async function readCurrentValues(
  appName: string,
  environment: string,
): Promise<string | null> {
  const localPath = getLocalPath();
  const fullPath = join(localPath, "apps", appName, environment, "values.yaml");
  try {
    return await readFile(fullPath, "utf-8");
  } catch {
    return null;
  }
}
