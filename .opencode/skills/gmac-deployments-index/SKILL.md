name: gmac-deployments-index
description: Use when you need to choose which GMAC delivery/deployment skill to load for feature delivery, staging/prod deployment verification, or incident rollback.

# GMAC Deployments Index

## Overview
Single entry point for GMAC delivery and deployments.

## When to Use
- The user asks to "deploy", "ship", "release", "promote", "roll back", or "verify" staging/prod.
- The user is unsure whether this is feature work, a deployment, or an incident.

## Load Order
1) Load `gmac-deployments-index` (this skill).
2) Load `tasks-gmac-mcp` (for evidence trail).
3) Then load exactly one of:
- `gmac-feature-delivery-loop` (task -> PR -> CI gates -> artifact plan)
- `gmac-deployments-e2e` (CI -> Harbor -> Kubernetes rollout verification)
- `gmac-incident-rollback` (unhealthy deploy -> rollback -> verify recovery)

## Decision Questions (Ask One, Only If Needed)
1) "Are we shipping a code change (PR), verifying a deployment, or rolling back an incident?"
2) "Which env: staging or prod?"

## Defaults (If User Doesn’t Know)
- If prod is unhealthy right now: use `gmac-incident-rollback`.
- Otherwise, if an image is ready and we are pushing it out: use `gmac-deployments-e2e`.
- Otherwise: use `gmac-feature-delivery-loop`.
