import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { bobService } from "@/lib/bob/client";
import {
  mockAiDevSessions,
  mockStats,
  getMockSession,
  getMockSessionLogs,
  getActiveMockSessions,
} from "@/lib/mock/ai-dev-data";

function shouldUseMock(request: NextRequest): boolean {
  const { searchParams } = new URL(request.url);
  return (
    searchParams.get("mock") === "true" ||
    process.env.USE_MOCK_DATA === "true" ||
    !process.env.DATABASE_URL
  );
}

function handleMockPost(
  action: string,
  body: Record<string, unknown>,
  session: { user: { email?: string | null; name?: string | null } },
  now: Date
) {
  switch (action) {
    case "create": {
      const newSession = {
        id: `mock-session-${Date.now()}`,
        issueSource: body.issueSource,
        issueId: body.issueId,
        issueTitle: body.issueTitle,
        issueUrl: body.issueUrl,
        issueSeverity: body.issueSeverity,
        applicationId: body.applicationId,
        applicationName: body.applicationName,
        repositoryUrl: body.repositoryUrl,
        branch: body.branch || "main",
        agentType: body.agentType || "claude",
        status: "pending",
        createdBy: session.user.email || session.user.name,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      return NextResponse.json({ session: newSession, created: true, mock: true });
    }

    case "start": {
      const mockSession = getMockSession(body.sessionId as string);
      if (!mockSession) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      return NextResponse.json({
        session: { ...mockSession, status: "cloning", worktreeId: `mock-worktree-${Date.now()}` },
        bobSession: { worktreeId: `mock-worktree-${Date.now()}`, instanceId: `mock-instance-${Date.now()}`, phase: "cloning", progress: 10 },
        mock: true,
      });
    }

    case "analyze": {
      const mockSession = getMockSession(body.sessionId as string);
      if (!mockSession) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      return NextResponse.json({
        session: { ...mockSession, status: "review" },
        analysis: {
          analysis: {
            summary: "Mock analysis: Found potential null reference issue.",
            comments: [
              { file: "src/components/Example.tsx", line: 42, type: "error", message: "Possible null dereference" },
              { file: "src/components/Example.tsx", line: 58, type: "suggestion", message: "Consider adding error boundary" },
            ],
            analysisId: `mock-analysis-${Date.now()}`,
          },
          diffAnalyzed: true,
        },
        mock: true,
      });
    }

    case "check-status": {
      const mockSession = getMockSession(body.sessionId as string);
      if (!mockSession) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      return NextResponse.json({
        session: mockSession,
        bobStatus: { worktreeId: (mockSession as Record<string, unknown>).worktreeId || "mock-worktree", phase: mockSession.status, progress: 50 },
        mock: true,
      });
    }

    case "approve": {
      const mockSession = getMockSession(body.sessionId as string);
      if (!mockSession) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      return NextResponse.json({
        session: { ...mockSession, status: "approved", prNumber: 99, prUrl: "https://gitea.gmac.io/gmackie/my-app/pulls/99" },
        pr: { success: true, prUrl: "https://gitea.gmac.io/gmackie/my-app/pulls/99", branch: mockSession.branch, title: `fix: ${mockSession.issueTitle}` },
        mock: true,
      });
    }

    case "reject": {
      return NextResponse.json({ success: true, status: "cancelled", mock: true });
    }

    case "cancel": {
      return NextResponse.json({ success: true, status: "cancelled", mock: true });
    }

    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "list";
    const sessionId = searchParams.get("sessionId");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const useMock = shouldUseMock(request);

    if (useMock) {
      switch (action) {
        case "list": {
          let sessions = [...mockAiDevSessions];
          if (status) {
            sessions = sessions.filter((s) => s.status === status);
          }
          return NextResponse.json({ sessions: sessions.slice(0, limit), mock: true });
        }

        case "active": {
          return NextResponse.json({ sessions: getActiveMockSessions(), mock: true });
        }

        case "get": {
          if (!sessionId) {
            return NextResponse.json({ error: "sessionId required" }, { status: 400 });
          }
          const mockSession = getMockSession(sessionId);
          if (!mockSession) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
          }
          return NextResponse.json({ session: mockSession, mock: true });
        }

        case "logs": {
          if (!sessionId) {
            return NextResponse.json({ error: "sessionId required" }, { status: 400 });
          }
          return NextResponse.json({ logs: getMockSessionLogs(sessionId), mock: true });
        }

        case "stats": {
          return NextResponse.json({ ...mockStats, mock: true });
        }

        case "bob-health": {
          return NextResponse.json({ healthy: true, service: "bob", mock: true });
        }

        default:
          return NextResponse.json({ error: "Invalid action" }, { status: 400 });
      }
    }

    const { getDb, aiDevSessions, aiDevSessionLogs, eq, desc, and, inArray } = await import("@repo/db");
    const db = getDb();

    switch (action) {
      case "list": {
        const conditions = [];
        if (status) {
          conditions.push(eq(aiDevSessions.status, status));
        }

        const results = await db
          .select()
          .from(aiDevSessions)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(aiDevSessions.createdAt))
          .limit(limit);

        return NextResponse.json({ sessions: results });
      }

      case "active": {
        const activeStatuses = ["pending", "cloning", "analyzing", "fixing", "testing", "review"];
        const results = await db
          .select()
          .from(aiDevSessions)
          .where(inArray(aiDevSessions.status, activeStatuses))
          .orderBy(desc(aiDevSessions.createdAt));

        return NextResponse.json({ sessions: results });
      }

      case "get": {
        if (!sessionId) {
          return NextResponse.json({ error: "sessionId required" }, { status: 400 });
        }
        const result = await db
          .select()
          .from(aiDevSessions)
          .where(eq(aiDevSessions.id, sessionId))
          .limit(1);

        if (!result[0]) {
          return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        return NextResponse.json({ session: result[0] });
      }

      case "logs": {
        if (!sessionId) {
          return NextResponse.json({ error: "sessionId required" }, { status: 400 });
        }
        const logs = await db
          .select()
          .from(aiDevSessionLogs)
          .where(eq(aiDevSessionLogs.sessionId, sessionId))
          .orderBy(desc(aiDevSessionLogs.timestamp))
          .limit(limit);

        return NextResponse.json({ logs });
      }

      case "stats": {
        const allSessions = await db.select().from(aiDevSessions);

        const pending = allSessions.filter((s) =>
          ["pending", "cloning", "analyzing", "fixing", "testing"].includes(s.status)
        );
        const inReview = allSessions.filter((s) => s.status === "review");
        const completed = allSessions.filter((s) =>
          ["approved", "merged"].includes(s.status)
        );
        const failed = allSessions.filter((s) =>
          ["failed", "cancelled"].includes(s.status)
        );

        const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentSessions = allSessions.filter(
          (s) => new Date(s.createdAt) > last7Days
        );

        return NextResponse.json({
          total: allSessions.length,
          pending: pending.length,
          inReview: inReview.length,
          completed: completed.length,
          failed: failed.length,
          successRate:
            allSessions.length > 0
              ? Math.round((completed.length / allSessions.length) * 100)
              : 0,
          last7Days: recentSessions.length,
        });
      }

      case "bob-health": {
        const healthy = await bobService.healthCheck();
        return NextResponse.json({ healthy, service: "bob" });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("AI Dev API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;
    const now = new Date();
    const useMock = shouldUseMock(request);

    if (useMock) {
      return handleMockPost(action, body, { user: session.user || {} }, now);
    }

    const { getDb, aiDevSessions, aiDevSessionLogs, eq } = await import("@repo/db");
    const db = getDb();

    switch (action) {
      case "create": {
        const {
          issueSource,
          issueId,
          issueTitle,
          issueUrl,
          issueSeverity,
          applicationId,
          applicationName,
          repositoryUrl,
          branch = "main",
          agentType = "claude",
        } = body;

        if (!issueSource || !issueId || !issueTitle || !repositoryUrl) {
          return NextResponse.json(
            { error: "Missing required fields: issueSource, issueId, issueTitle, repositoryUrl" },
            { status: 400 }
          );
        }

        const result = await db.insert(aiDevSessions).values({
          issueSource,
          issueId,
          issueTitle,
          issueUrl,
          issueSeverity,
          applicationId,
          applicationName,
          repositoryUrl,
          branch,
          agentType,
          status: "pending",
          createdBy: session.user.email || session.user.name,
          createdAt: now,
          updatedAt: now,
        }).returning();

        return NextResponse.json({ session: result[0], created: true });
      }

      case "start": {
        const { sessionId } = body;
        if (!sessionId) {
          return NextResponse.json({ error: "sessionId required" }, { status: 400 });
        }

        const sessionResult = await db
          .select()
          .from(aiDevSessions)
          .where(eq(aiDevSessions.id, sessionId))
          .limit(1);

        const devSession = sessionResult[0];
        if (!devSession) {
          return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        const bobSession = await bobService.startFixSession({
          repositoryUrl: devSession.repositoryUrl,
          branch: devSession.branch,
          issueContext: {
            source: devSession.issueSource as "sentry" | "posthog" | "manual",
            id: devSession.issueId,
            title: devSession.issueTitle,
            description: devSession.issueUrl || undefined,
          },
          agentType: devSession.agentType as "claude" | "kiro" | "codex" | "opencode" | "cursor" | "gemini",
        });

        await db
          .update(aiDevSessions)
          .set({
            status: "cloning",
            worktreeId: bobSession.worktreeId,
            agentInstanceId: bobSession.instanceId,
            startedAt: now,
            updatedAt: now,
          })
          .where(eq(aiDevSessions.id, sessionId));

        await db.insert(aiDevSessionLogs).values({
          sessionId,
          level: "info",
          phase: "cloning",
          message: "Started AI fix session with Bob",
          details: JSON.stringify({ worktreeId: bobSession.worktreeId }),
          progress: 10,
          timestamp: now,
        });

        return NextResponse.json({
          session: { ...devSession, status: "cloning", worktreeId: bobSession.worktreeId },
          bobSession,
        });
      }

      case "analyze": {
        const { sessionId } = body;
        if (!sessionId) {
          return NextResponse.json({ error: "sessionId required" }, { status: 400 });
        }

        const sessionResult = await db
          .select()
          .from(aiDevSessions)
          .where(eq(aiDevSessions.id, sessionId))
          .limit(1);

        const devSession = sessionResult[0];
        if (!devSession || !devSession.worktreeId) {
          return NextResponse.json({ error: "Session not found or not started" }, { status: 404 });
        }

        try {
          await db
            .update(aiDevSessions)
            .set({ status: "analyzing", updatedAt: now })
            .where(eq(aiDevSessions.id, sessionId));

          await db.insert(aiDevSessionLogs).values({
            sessionId,
            level: "info",
            phase: "analyzing",
            message: "Starting AI analysis of the codebase",
            progress: 40,
            timestamp: now,
          });

          const analysisResult = await bobService.runAnalysis(devSession.worktreeId);

          await db
            .update(aiDevSessions)
            .set({
              status: "review",
              analysisResult: JSON.stringify(analysisResult.analysis),
              updatedAt: now,
            })
            .where(eq(aiDevSessions.id, sessionId));

          await db.insert(aiDevSessionLogs).values({
            sessionId,
            level: "info",
            phase: "review",
            message: `Analysis complete: ${analysisResult.analysis.comments?.length || 0} suggestions`,
            progress: 80,
            timestamp: now,
          });

          return NextResponse.json({
            session: { ...devSession, status: "review" },
            analysis: analysisResult,
          });
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Analysis failed";

          await db
            .update(aiDevSessions)
            .set({ status: "failed", errorMessage, updatedAt: now })
            .where(eq(aiDevSessions.id, sessionId));

          await db.insert(aiDevSessionLogs).values({
            sessionId,
            level: "error",
            phase: "analyzing",
            message: `Analysis failed: ${errorMessage}`,
            progress: 0,
            timestamp: now,
          });

          return NextResponse.json({ error: errorMessage }, { status: 500 });
        }
      }

      case "check-status": {
        const { sessionId } = body;
        if (!sessionId) {
          return NextResponse.json({ error: "sessionId required" }, { status: 400 });
        }

        const sessionResult = await db
          .select()
          .from(aiDevSessions)
          .where(eq(aiDevSessions.id, sessionId))
          .limit(1);

        const devSession = sessionResult[0];
        if (!devSession || !devSession.worktreeId) {
          return NextResponse.json({ error: "Session not found or not started" }, { status: 404 });
        }

        const bobStatus = await bobService.getSessionStatus(devSession.worktreeId);

        const statusMap: Record<string, string> = {
          cloning: "cloning",
          analyzing: "analyzing",
          fixing: "fixing",
          testing: "testing",
          review: "review",
          complete: "review",
          error: "failed",
        };

        const newStatus = statusMap[bobStatus.phase] || devSession.status;

        if (newStatus !== devSession.status) {
          await db
            .update(aiDevSessions)
            .set({
              status: newStatus,
              analysisResult: bobStatus.analysis ? JSON.stringify(bobStatus.analysis) : null,
              updatedAt: now,
            })
            .where(eq(aiDevSessions.id, sessionId));

          await db.insert(aiDevSessionLogs).values({
            sessionId,
            level: "info",
            phase: bobStatus.phase,
            message: `Phase changed to ${bobStatus.phase}`,
            progress: bobStatus.progress,
            timestamp: now,
          });
        }

        return NextResponse.json({
          session: { ...devSession, status: newStatus },
          bobStatus,
        });
      }

      case "approve": {
        const { sessionId } = body;
        if (!sessionId) {
          return NextResponse.json({ error: "sessionId required" }, { status: 400 });
        }

        const sessionResult = await db
          .select()
          .from(aiDevSessions)
          .where(eq(aiDevSessions.id, sessionId))
          .limit(1);

        const devSession = sessionResult[0];
        if (!devSession || !devSession.worktreeId) {
          return NextResponse.json({ error: "Session not found or not started" }, { status: 404 });
        }

        try {
          const commitMessage = `fix: ${devSession.issueTitle}\n\nFixes ${devSession.issueSource} issue ${devSession.issueId}`;
          const prResult = await bobService.approveAndCreatePR(devSession.worktreeId, commitMessage);

          const prNumber = prResult.pr ? parseInt(prResult.pr.match(/\/pull\/(\d+)/)?.[1] || "0") : undefined;

          await db
            .update(aiDevSessions)
            .set({
              status: "approved",
              prNumber,
              prUrl: prResult.pr,
              prTitle: prResult.title,
              prStatus: "open",
              approvedBy: session.user.email || session.user.name,
              approvedAt: now,
              updatedAt: now,
            })
            .where(eq(aiDevSessions.id, sessionId));

          await db.insert(aiDevSessionLogs).values({
            sessionId,
            level: "info",
            phase: "pr_creation",
            message: prResult.pr 
              ? `Created PR: ${prResult.title}` 
              : `Branch pushed: ${prResult.branch}`,
            progress: 100,
            timestamp: now,
          });

          return NextResponse.json({
            session: { ...devSession, status: "approved" },
            pr: { success: true, prUrl: prResult.pr, branch: prResult.branch, title: prResult.title },
          });
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Failed to create PR";
          
          await db
            .update(aiDevSessions)
            .set({
              status: "failed",
              errorMessage,
              updatedAt: now,
            })
            .where(eq(aiDevSessions.id, sessionId));

          await db.insert(aiDevSessionLogs).values({
            sessionId,
            level: "error",
            phase: "pr_creation",
            message: `Failed to create PR: ${errorMessage}`,
            progress: 0,
            timestamp: now,
          });

          return NextResponse.json({
            session: { ...devSession, status: "failed" },
            pr: { success: false, error: errorMessage },
          });
        }
      }

      case "reject": {
        const { sessionId, reason } = body;
        if (!sessionId) {
          return NextResponse.json({ error: "sessionId required" }, { status: 400 });
        }

        await db
          .update(aiDevSessions)
          .set({
            status: "cancelled",
            rejectionReason: reason,
            completedAt: now,
            updatedAt: now,
          })
          .where(eq(aiDevSessions.id, sessionId));

        await db.insert(aiDevSessionLogs).values({
          sessionId,
          level: "warn",
          phase: "rejected",
          message: `Session rejected: ${reason || "No reason provided"}`,
          progress: 0,
          timestamp: now,
        });

        return NextResponse.json({ success: true, status: "cancelled" });
      }

      case "cancel": {
        const { sessionId } = body;
        if (!sessionId) {
          return NextResponse.json({ error: "sessionId required" }, { status: 400 });
        }

        const sessionResult = await db
          .select()
          .from(aiDevSessions)
          .where(eq(aiDevSessions.id, sessionId))
          .limit(1);

        const devSession = sessionResult[0];
        if (devSession?.worktreeId) {
          try {
            await bobService.cancelSession(devSession.worktreeId);
          } catch (e) {
            console.error("Failed to cancel Bob session:", e);
          }
        }

        await db
          .update(aiDevSessions)
          .set({
            status: "cancelled",
            completedAt: now,
            updatedAt: now,
          })
          .where(eq(aiDevSessions.id, sessionId));

        await db.insert(aiDevSessionLogs).values({
          sessionId,
          level: "info",
          phase: "cancelled",
          message: "Session cancelled by user",
          progress: 0,
          timestamp: now,
        });

        return NextResponse.json({ success: true, status: "cancelled" });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("AI Dev API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
