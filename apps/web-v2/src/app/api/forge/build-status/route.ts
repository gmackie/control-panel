import { NextRequest, NextResponse } from "next/server";
import {
  verifyBearerToken,
  RateLimitError,
  webhookLimiter,
  storeDeploymentEvent,
} from "@repo/webhooks";
import { normalizeStatus, isValidTransition } from "@repo/forgegraph";
import { getDb } from "@/lib/db";

interface BuildStatusBody {
  repoId: string;
  revId: string;
  status: string;
  previousStatus?: string;
  metadata?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  const startMs = Date.now();
  const requestId = crypto.randomUUID();

  try {
    await webhookLimiter.checkLimit(request);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Rate limit exceeded", retryAfter: error.retryAfter },
        { status: 429, headers: { "Retry-After": String(error.retryAfter || 60) } },
      );
    }
    throw error;
  }

  const authToken = (
    process.env.FORGEGRAPH_CONTROL_PLANE_WEBHOOK_TOKEN ||
    process.env.PROMETHEUS_BEARER_TOKEN ||
    ""
  ).trim();
  const authHeader = request.headers.get("Authorization");
  const webhookToken = request.headers.get("x-webhook-token");
  const verification = verifyBearerToken(authHeader, webhookToken, authToken);

  if (!verification.valid) {
    return NextResponse.json(
      { error: "Unauthorized", reason: verification.error },
      { status: 401 },
    );
  }

  let body: BuildStatusBody;
  try {
    body = await request.json();
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    throw err;
  }

  if (!body.repoId || !body.revId || !body.status) {
    return NextResponse.json(
      { error: "Missing required fields: repoId, revId, status" },
      { status: 400 },
    );
  }

  const normalized = normalizeStatus(body.status);

  if (body.previousStatus) {
    const previousNormalized = normalizeStatus(body.previousStatus);
    if (!isValidTransition(previousNormalized, normalized)) {
      return NextResponse.json(
        {
          error: `Invalid status transition: ${previousNormalized} → ${normalized}`,
          from: previousNormalized,
          to: normalized,
        },
        { status: 422 },
      );
    }
  }

  try {
    const db = getDb();
    const deploymentId = await storeDeploymentEvent(db, {
      applicationId: body.repoId,
      applicationName: body.repoId,
      environment: "ci",
      action: "build",
      status: normalized as "building" | "failed" | "healthy",
      triggeredBy: "forgegraph",
      version: body.revId,
      commitSha: body.revId,
      metadata: {
        ...body.metadata,
        forgeGraphRepoId: body.repoId,
        forgeGraphRevId: body.revId,
        originalStatus: body.status,
        normalizedStatus: normalized,
        requestId,
      },
    });

    const processingTimeMs = Date.now() - startMs;

    return NextResponse.json(
      {
        success: true,
        deploymentId,
        status: normalized,
        repoId: body.repoId,
        revId: body.revId,
      },
      {
        headers: {
          "X-Processing-Time-Ms": String(processingTimeMs),
          "X-Request-Id": requestId,
        },
      },
    );
  } catch (error) {
    console.error("Error processing build status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
