# GMAC Deployments E2E - Reference

This file is intentionally more detailed than `SKILL.md`.

## Ground Truth In This Repo (Current)
- Kubernetes manifests live in `k8s/`.
- Primary workload label: `app.kubernetes.io/name=control-panel`.
- Primary namespace: `control-panel`.
- Example deployment uses Harbor image: `registry.gmac.io/gmac/control-panel:latest` in `k8s/04-deployment.yaml`.
- Common rollout commands appear across scripts/docs: `kubectl apply -f k8s/`, `kubectl rollout status`, `kubectl rollout undo`.
- ArgoCD is present as a planned/optional path: `k8s/argocd-application.yaml`.

## Evidence Record (What to Write into tasks.gmac)
Record these as plain text lines in a comment:
- PR: `<url>`
- Commit: `<sha>`
- Required checks: `pass|fail` (name the checks if possible)
- Gitea Actions run: `run_id=<id>` (and optionally job_id(s))
- Harbor image: `registry.gmac.io/<project>/<repo>:<tag>`
- Harbor digest: `sha256:<...>` (when available)
- Kubernetes target: `env=<staging|prod> namespace=<ns> workload=<Deployment name>`
- Kubernetes result: `rollout=success pods_ready=<n>/<n>`
- Runtime proof: `pod_imageID=<...>` (imageID digest from pod status when available)

## OpenCode vs Claude Code: Tool Mapping

OpenCode examples use tools like:
- `functions.gitea-mcp_list_repo_action_runs`
- `functions.harbor-mcp_list_repositories`
- `functions.kubernetes-mcp_pods_list_in_namespace`
- tasks.gmac via `functions.skill_mcp({ mcp_name: "tasks-gmac", tool_name: "..." })`

Claude Code examples will use the same MCP servers but tool names depend on registration.
If the tool names differ, keep the *sequence and evidence* identical.

## Checklist: Deploy/Verify (Raw Manifests Today)

### 0) Identify target
- Env: `staging` or `prod`
- Namespace: usually `control-panel`
- Workload: usually `Deployment/control-panel`
- Label selector: `app.kubernetes.io/name=control-panel`

### 1) tasks.gmac: create/annotate the deploy task
OpenCode (conceptual):
```json
{"mcp_name":"tasks-gmac","tool_name":"create_task","arguments":"{\"projectId\":\"...\",\"title\":\"[Deploy] control-panel to prod\",\"description\":\"...\"}"}
```
Then add a comment with the evidence record scaffold (PR, commit, env, namespace, workload).

### 2) PR required checks + Gitea Actions run evidence
Gitea MCP (OpenCode):
1) Find the run for the commit/branch.
2) List jobs.
3) Pull a job log preview to locate the pushed image tag.

Example calls:
```text
gitea-mcp_list_repo_action_runs(owner, repo)
gitea-mcp_list_repo_action_run_jobs(owner, repo, run_id)
gitea-mcp_get_repo_action_job_log_preview(owner, repo, job_id, tail_lines=200)
```

Gate: both PR required checks and Actions run(s) succeeded.

### 3) Harbor: confirm image tag exists
Harbor MCP (OpenCode):
```text
harbor-mcp_list_projects()
harbor-mcp_list_repositories(projectId)
harbor-mcp_list_tags(projectId, repositoryName)
```
Gate: expected tag exists in the expected repository.

If digest is not available via MCP, record the best-available tuple:
- `repo:tag`
- `push_time`
Then rely on Kubernetes runtime proof (pod `imageID`) as the immutable identity.

### 4) Kubernetes: rollout + runtime proof
Kubernetes MCP (OpenCode):
```text
kubernetes-mcp_resources_get(apiVersion="apps/v1", kind="Deployment", namespace="control-panel", name="control-panel")
kubernetes-mcp_pods_list_in_namespace(namespace="control-panel", labelSelector="app.kubernetes.io/name=control-panel")
kubernetes-mcp_events_list(namespace="control-panel")
kubernetes-mcp_pods_log(namespace="control-panel", name="<pod>", tail=200)
```

Gates:
- Rollout converges (desired replicas ready)
- No `ImagePullBackOff` / `CrashLoopBackOff`
- No repeating Warning events
- Pods are running the expected `image` (and record `imageID` digest if present)

### 5) Rollback readiness (today: kubectl; future: Helm)
Today, the skill should treat rollback as one of:
- `kubectl rollout undo deployment/<name> -n <ns>`
- re-apply last-known-good manifests

Future (once Helm is real):
- Prefer `helm rollback <release> <rev>`.

## ArgoCD Future Gates (for when it becomes the primary path)
Use these high-signal fields:
- `Application.status.sync.status == Synced`
- `Application.status.health.status == Healthy`
- Stop if `Application.status.conditions` contains `InvalidSpecError`, `ComparisonError`, `SyncError`
- Stop if `Application.status.operationState.phase` is `Failed`/`Error` or stuck `Running` beyond timeout

## Templates
See `.opencode/skills/gmac-deployments-e2e/templates.md`.
