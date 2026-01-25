name: gmac-deployments-e2e
description: Use when monitoring or executing a staging/prod deployment end-to-end (Gitea CI + required checks -> Harbor image -> Kubernetes rollout), including stop conditions and rollback readiness.

# GMAC Deployments E2E

**REQUIRED SUB-SKILL:** Use `tasks-gmac-mcp` to create/update the deployment work item and capture evidence.

## Overview
Default today: raw manifests + `kubectl apply` style rollouts, images in Harbor.
Planned: ArgoCD (GitOps) and Helm (including Helm rollback). Skills must work now and stay future-proof.

## When to Use
- Deploying (or verifying) a change to `staging` or `prod`.
- Proving the chain of custody: PR checks + Gitea Actions -> Harbor tag -> pods running.

## Hard Rules
- Do not deploy unless explicitly requested.
- Do not delete Harbor tags/repos/projects unless explicitly requested.
- Record evidence as machine-verifiable strings (run ids, image refs, digests) in tasks.gmac.

## Gates (Stop Conditions)
- CI is not green on BOTH: PR required checks and Gitea Actions runs for the deploy commit.
- Harbor tag does not exist (or is ambiguous).
- Kubernetes rollout shows: `ImagePullBackOff`, `CrashLoopBackOff`, repeating Warning events, or rollout timeout.

## Minimal E2E Loop (Current: Raw Manifests)
1) **Anchor the deploy**: tasks.gmac task exists; comment includes env, namespace, workload name, expected image ref.
2) **CI proof**: capture required checks status + Gitea Actions run/job ids and log excerpt proving the pushed image tag.
3) **Harbor proof**: confirm tag exists in the expected repository; record push time (and digest when available).
4) **Kubernetes proof**: verify rollout and that pods are running the expected image (and imageID digest if available).
5) **Hold window**: brief post-deploy monitoring window; record any alerts/events.

## Future-Proofing
- ArgoCD: gate on `Application.status.sync.status == Synced` and `Application.status.health.status == Healthy`.
- Helm: prefer `helm rollback` to previous revision for rollback once migration is real.

See `.opencode/skills/gmac-deployments-e2e/reference.md` for the full step-by-step with concrete MCP call examples (OpenCode + Claude Code).
