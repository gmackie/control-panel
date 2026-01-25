name: gmac-feature-delivery-loop
description: Use when delivering a feature via tasks.gmac -> PR -> CI gates, and you need a deploy-ready plan for staging/prod with Gitea checks and Harbor image readiness.

# GMAC Feature Delivery Loop

**REQUIRED SUB-SKILL:** Use `tasks-gmac-mcp` for task/project operations.

## Overview
Ship features with traceability: task -> PR -> required checks + Gitea Actions -> known artifact -> deploy plan (staging then prod).

## When to Use
- A feature/bugfix needs a PR and must be deploy-ready for `staging`/`prod`.
- You need an explicit evidence trail tying code to CI checks and an image in Harbor.

## Red Flags (Stop and Ask)
- You cannot name the target env (`staging` or `prod`) and Kubernetes namespace.
- You cannot identify which CI run corresponds to the PR commit.
- Harbor tag scheme is unclear (you cannot state the exact image ref that will be deployed).

## Checklist (Gates)
1) **Create/Link Work Item (tasks.gmac)**
- Create task with: goal, scope, acceptance criteria, target env(s), rollback note.
- Comment: branch name and PR link once created.

2) **PR Created and Reviewable**
- PR includes: what/why, how to test, deployment notes (staging/prod), rollback plan.
- Gate: PR has required checks configured (do not rely on a single workflow run).

3) **CI Green (Both Signals)**
- Gate A: required checks on PR are passing.
- Gate B: Gitea Actions workflow run(s) for the PR commit are `success`.
- If either is red/unknown: stop, attach failing job log excerpt to the task.

4) **Artifact Plan (Harbor)**
- State the expected image reference for deploy: `registry.gmac.io/<project>/<repo>:<tag>`.
- Prefer pinning digest later; for now record at least `repo:tag` and push time.
- Gate: tag exists in Harbor for the commit being merged.

5) **Ready-To-Deploy Note**
- Update task status to `in_review` when PR is open; to `done` only after prod deploy verification.
- Comment includes: PR URL, CI run id(s), Harbor image ref, target env(s), and verification steps.

## Tooling Notes
- OpenCode uses `functions.gitea-mcp_*`, `functions.harbor-mcp_*`, `functions.kubernetes-mcp_*`.
- Claude Code uses the same MCP servers but tool names may be prefixed (e.g., `mcp__gitea__...`).

See `.opencode/skills/gmac-deployments-e2e/reference.md` for concrete MCP call examples and a full deploy-ready task/PR template.
