name: gmac-incident-rollback
description: Use when a staging/prod deployment is unhealthy (CrashLoop/ImagePull/alerts) and you need a safe rollback plan with evidence, using Kubernetes + Harbor + CI traceability and tasks.gmac incident tracking.

# GMAC Incident Rollback

**REQUIRED SUB-SKILL:** Use `tasks-gmac-mcp` to create an incident task and capture evidence.

## Overview
Restore service safely with a tight evidence trail. Today: raw manifests and `kubectl rollout undo`. Future: Helm rollback; ArgoCD rollback once GitOps is primary.

## Stop Conditions (Don’t Roll Back Yet)
- You cannot prove which workload changed (wrong namespace/workload ambiguity).
- The release included a DB migration that may not be backward compatible.
- Symptoms appear cluster-wide (nodes NotReady, widespread ImagePullBackOff).

## Rollback Checklist
1) **Create incident task** (priority urgent). Record start time, env, namespace, workload.
2) **Capture baseline evidence**: pods list, a failing pod describe + previous logs, recent events.
3) **Identify last-known-good**: previous rollout revision or prior image digest/tag.
4) **Rollback** (today): `kubectl rollout undo deployment/<name> -n <ns>` (or re-apply last-known-good manifests).
5) **Verify recovery**: rollout converges; pods Ready; Warning events stop; smoke check if available.
6) **Write incident note**: what happened, what changed, what evidence collected, follow-ups.

## Future Hooks
- Helm migration: prefer `helm rollback` over ad-hoc image pinning.
- ArgoCD: gate on `Application.status.sync` + `health`, and stop on `conditions`/`operationState` failures.

See `.opencode/skills/gmac-deployments-e2e/reference.md` for the full Kubernetes/Harbor evidence fields.
