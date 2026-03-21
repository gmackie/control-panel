import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  initGitOpsRepo,
  commitDeployment,
  commitRollback,
  GitOpsConflictError,
} from "../gitops";

const execFile = promisify(execFileCb);

/**
 * Helper: create a bare git repo with an initial commit on main,
 * and return the path to the bare repo and a working checkout.
 */
async function createTestRepos(): Promise<{
  bareDir: string;
  checkoutDir: string;
}> {
  const baseDir = await mkdtemp(join(tmpdir(), "gitops-test-"));
  const bareDir = join(baseDir, "bare.git");
  const seedDir = join(baseDir, "seed");
  const checkoutDir = join(baseDir, "checkout");

  // Create bare repo with main as default branch
  await execFile("git", ["init", "--bare", "--initial-branch=main", bareDir]);

  // Create a seed clone, make initial commit, push
  await execFile("git", ["clone", bareDir, seedDir]);
  await execFile("git", ["-C", seedDir, "config", "user.email", "test@test.com"]);
  await execFile("git", ["-C", seedDir, "config", "user.name", "Test"]);
  await execFile("git", ["-C", seedDir, "checkout", "-b", "main"]);
  await execFile("git", ["-C", seedDir, "commit", "--allow-empty", "-m", "init"]);
  await execFile("git", ["-C", seedDir, "push", "-u", "origin", "main"]);

  return { bareDir, checkoutDir };
}

describe("gitops", () => {
  let bareDir: string;
  let checkoutDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    const repos = await createTestRepos();
    bareDir = repos.bareDir;
    checkoutDir = repos.checkoutDir;
    process.env.GITOPS_REPO_URL = bareDir;
    process.env.GITOPS_LOCAL_PATH = checkoutDir;
    // Remove auth vars so they don't interfere
    delete process.env.GITOPS_SSH_KEY_PATH;
    delete process.env.GITOPS_TOKEN;
  });

  afterEach(async () => {
    process.env = originalEnv;
    // Clean up temp dirs
    if (checkoutDir) {
      const baseDir = join(checkoutDir, "..");
      await rm(baseDir, { recursive: true, force: true });
    }
  });

  describe("initGitOpsRepo", () => {
    it("clones the repo when checkout does not exist", async () => {
      await initGitOpsRepo(bareDir, checkoutDir);

      const { stdout } = await execFile("git", [
        "-C",
        checkoutDir,
        "rev-parse",
        "HEAD",
      ]);
      expect(stdout.trim()).toMatch(/^[0-9a-f]{40}$/);
    });

    it("fetches when checkout already exists", async () => {
      await initGitOpsRepo(bareDir, checkoutDir);
      // Call again — should fetch, not fail
      await initGitOpsRepo(bareDir, checkoutDir);

      const { stdout } = await execFile("git", [
        "-C",
        checkoutDir,
        "rev-parse",
        "HEAD",
      ]);
      expect(stdout.trim()).toMatch(/^[0-9a-f]{40}$/);
    });
  });

  describe("commitDeployment", () => {
    it("creates the correct file structure and commits", async () => {
      await initGitOpsRepo(bareDir, checkoutDir);
      // Configure git user for the checkout
      await execFile("git", ["-C", checkoutDir, "config", "user.email", "test@test.com"]);
      await execFile("git", ["-C", checkoutDir, "config", "user.name", "Test"]);

      const sha = await commitDeployment({
        appName: "my-app",
        environment: "staging",
        imageRepository: "registry.example.com/my-app",
        imageTag: "v1.2.3",
        imageDigest: "sha256:abc123",
        commitMessage: "deploy my-app v1.2.3 to staging",
      });

      expect(sha).toMatch(/^[0-9a-f]{40}$/);

      // Verify the file was written correctly
      const valuesPath = join(
        checkoutDir,
        "apps",
        "my-app",
        "staging",
        "values.yaml",
      );
      const content = await readFile(valuesPath, "utf-8");
      expect(content).toContain("repository: registry.example.com/my-app");
      expect(content).toContain('tag: "v1.2.3"');
      expect(content).toContain('digest: "sha256:abc123"');

      // Verify commit message in git log
      const { stdout: logOut } = await execFile("git", [
        "-C",
        checkoutDir,
        "log",
        "-1",
        "--format=%s",
      ]);
      expect(logOut.trim()).toBe("deploy my-app v1.2.3 to staging");
    });

    it("omits digest when not provided", async () => {
      await initGitOpsRepo(bareDir, checkoutDir);
      await execFile("git", ["-C", checkoutDir, "config", "user.email", "test@test.com"]);
      await execFile("git", ["-C", checkoutDir, "config", "user.name", "Test"]);

      await commitDeployment({
        appName: "my-app",
        environment: "production",
        imageRepository: "registry.example.com/my-app",
        imageTag: "v1.0.0",
        commitMessage: "deploy to prod",
      });

      const valuesPath = join(
        checkoutDir,
        "apps",
        "my-app",
        "production",
        "values.yaml",
      );
      const content = await readFile(valuesPath, "utf-8");
      expect(content).not.toContain("digest");
    });
  });

  describe("commitRollback", () => {
    it("prefixes commit message with rollback:", async () => {
      await initGitOpsRepo(bareDir, checkoutDir);
      await execFile("git", ["-C", checkoutDir, "config", "user.email", "test@test.com"]);
      await execFile("git", ["-C", checkoutDir, "config", "user.name", "Test"]);

      await commitRollback({
        appName: "my-app",
        environment: "staging",
        imageRepository: "registry.example.com/my-app",
        imageTag: "v1.1.0",
        commitMessage: "revert to v1.1.0",
      });

      const { stdout: logOut } = await execFile("git", [
        "-C",
        checkoutDir,
        "log",
        "-1",
        "--format=%s",
      ]);
      expect(logOut.trim()).toBe("rollback: revert to v1.1.0");
    });
  });

  describe("conflict retry", () => {
    it("retries on push conflict and succeeds", async () => {
      await initGitOpsRepo(bareDir, checkoutDir);
      await execFile("git", ["-C", checkoutDir, "config", "user.email", "test@test.com"]);
      await execFile("git", ["-C", checkoutDir, "config", "user.name", "Test"]);

      // Push a conflicting commit directly to the bare repo via a separate clone
      const baseDir = join(checkoutDir, "..");
      const rivalDir = join(baseDir, "rival");
      await execFile("git", ["clone", bareDir, rivalDir]);
      await execFile("git", ["-C", rivalDir, "config", "user.email", "rival@test.com"]);
      await execFile("git", ["-C", rivalDir, "config", "user.name", "Rival"]);
      await execFile("git", [
        "-C",
        rivalDir,
        "commit",
        "--allow-empty",
        "-m",
        "rival commit",
      ]);
      await execFile("git", ["-C", rivalDir, "push", "origin", "main"]);

      // Now our checkout is behind. commitDeployment should fetch+reset and retry.
      const sha = await commitDeployment({
        appName: "my-app",
        environment: "staging",
        imageRepository: "registry.example.com/my-app",
        imageTag: "v2.0.0",
        commitMessage: "deploy v2.0.0",
      });

      expect(sha).toMatch(/^[0-9a-f]{40}$/);
    });

    it("throws GitOpsConflictError after max retries", async () => {
      await initGitOpsRepo(bareDir, checkoutDir);
      await execFile("git", ["-C", checkoutDir, "config", "user.email", "test@test.com"]);
      await execFile("git", ["-C", checkoutDir, "config", "user.name", "Test"]);

      // Make the bare repo reject pushes by setting receive.denyCurrentBranch
      // Actually, we simulate persistent conflicts by using a pre-receive hook
      // that always fails.
      const hookPath = join(bareDir, "hooks", "pre-receive");
      const { writeFile: writeFileSync } = await import("node:fs/promises");
      await writeFileSync(
        hookPath,
        "#!/bin/sh\nexit 1\n",
        { mode: 0o755 },
      );

      await expect(
        commitDeployment({
          appName: "my-app",
          environment: "staging",
          imageRepository: "registry.example.com/my-app",
          imageTag: "v3.0.0",
          commitMessage: "this will fail",
        }),
      ).rejects.toThrow(GitOpsConflictError);
    });
  });
});
