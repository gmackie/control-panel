# Templates

## tasks.gmac Deploy Task
```md
## Goal
Deploy <service> to <staging|prod>.

## Target
- env: <staging|prod>
- namespace: <ns>
- workload: <Deployment name>
- labelSelector: <k8s label selector>

## Acceptance Criteria
- [ ] PR required checks passing
- [ ] Gitea Actions run succeeded for commit
- [ ] Harbor tag exists: registry.gmac.io/<project>/<repo>:<tag>
- [ ] Kubernetes rollout healthy (no CrashLoop/ImagePull)
- [ ] Runtime proof captured (pod imageID digest if available)

## Rollback Plan
- Today: kubectl rollout undo or re-apply last-known-good manifests
- Future: Helm rollback when Helm migration is complete

## Evidence
- PR: <url>
- Commit: <sha>
- Checks: <names + status>
- Gitea run/job: <ids>
- Harbor image: <repo:tag>
- Harbor digest: <sha256:...>
- K8s result: <pods_ready, events, logs summary>
```

## PR Description Block
```md
## What / Why

## How To Test

## Deployment Notes
- Envs: staging -> prod
- Artifact: registry.gmac.io/<project>/<repo>:<tag>
- Rollback: kubectl rollout undo deployment/<name> -n <ns>

## Links
- Task: <TASK-ID>
```

## Deployment Report Comment
```md
## Deployment Report
- env/namespace: <staging|prod>/<ns>
- workload: <kind>/<name>
- commit: <sha>
- checks: required=<pass> actions=<pass>
- harbor: <repo:tag> digest=<sha256:...>

## Kubernetes Verification
- rollout: <success|failed>
- pods: <n>/<n> ready
- events: <none|notable warnings>
- logs: <clean|notable lines>

## Result
- outcome: <success|rolled back>
- follow-ups: <links>
```
