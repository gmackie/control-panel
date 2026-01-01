/**
 * Mock data for AI Dev integration tests
 * Mirrors the web app mock data structure
 */

export const mockSentryIssues = [
  {
    id: "sentry-001",
    source: "sentry" as const,
    shortId: "MYAPP-1A2B",
    title: "TypeError: Cannot read property 'map' of undefined",
    culprit: "UserList.tsx in renderUsers",
    level: "error" as const,
    count: 142,
    userCount: 38,
    firstSeen: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    project: {
      id: "proj-1",
      name: "my-app",
      slug: "gmackie/my-app",
    },
  },
  {
    id: "sentry-002",
    source: "sentry" as const,
    shortId: "MYAPP-3C4D",
    title: "Unhandled Promise Rejection: Network request failed",
    culprit: "api/client.ts in fetchData",
    level: "fatal" as const,
    count: 89,
    userCount: 24,
    firstSeen: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    lastSeen: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    project: {
      id: "proj-1",
      name: "my-app",
      slug: "gmackie/my-app",
    },
  },
  {
    id: "sentry-003",
    source: "sentry" as const,
    shortId: "AUTH-5E6F",
    title: "ReferenceError: session is not defined",
    culprit: "middleware.ts in authCheck",
    level: "error" as const,
    count: 56,
    userCount: 12,
    firstSeen: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    lastSeen: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    project: {
      id: "proj-2",
      name: "auth-service",
      slug: "gmackie/auth-service",
    },
  },
  {
    id: "sentry-004",
    source: "sentry" as const,
    shortId: "API-7G8H",
    title: "SyntaxError: Unexpected token < in JSON at position 0",
    culprit: "hooks/useApi.ts in parseResponse",
    level: "warning" as const,
    count: 23,
    userCount: 8,
    firstSeen: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    lastSeen: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    project: {
      id: "proj-1",
      name: "my-app",
      slug: "gmackie/my-app",
    },
  },
];

export const mockAiDevSessions = [
  {
    id: "session-001",
    issueSource: "sentry",
    issueId: "sentry-001",
    issueTitle: "TypeError: Cannot read property 'map' of undefined",
    issueSeverity: "error",
    applicationName: "my-app",
    repositoryUrl: "https://gitea.gmac.io/gmackie/my-app",
    branch: "ai-fix/sentry-001",
    agentType: "claude",
    status: "analyzing" as const,
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    startedAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
  },
  {
    id: "session-002",
    issueSource: "sentry",
    issueId: "sentry-002",
    issueTitle: "Unhandled Promise Rejection: Network request failed",
    issueSeverity: "fatal",
    applicationName: "my-app",
    repositoryUrl: "https://gitea.gmac.io/gmackie/my-app",
    branch: "ai-fix/sentry-002",
    agentType: "claude",
    status: "review" as const,
    analysisResult: JSON.stringify({
      summary: "The network request fails because there's no error handling for offline scenarios.",
      comments: [
        { file: "api/client.ts", line: 42, type: "error", message: "Missing try-catch block" },
        { file: "api/client.ts", line: 45, type: "suggestion", message: "Add retry logic" },
      ],
    }),
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    startedAt: new Date(Date.now() - 44 * 60 * 1000).toISOString(),
  },
  {
    id: "session-003",
    issueSource: "sentry",
    issueId: "sentry-003",
    issueTitle: "ReferenceError: session is not defined",
    issueSeverity: "error",
    applicationName: "auth-service",
    repositoryUrl: "https://gitea.gmac.io/gmackie/auth-service",
    branch: "ai-fix/sentry-003",
    agentType: "claude",
    status: "approved" as const,
    prNumber: 42,
    prUrl: "https://gitea.gmac.io/gmackie/auth-service/pulls/42",
    prTitle: "fix: add session check in middleware",
    prStatus: "open",
    approvedBy: "gmackie",
    approvedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 60000).toISOString(),
    completedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: "session-004",
    issueSource: "manual",
    issueId: "manual-001",
    issueTitle: "Refactor authentication flow",
    applicationName: "auth-service",
    repositoryUrl: "https://gitea.gmac.io/gmackie/auth-service",
    branch: "ai-fix/manual-001",
    agentType: "claude",
    status: "failed" as const,
    errorMessage: "Agent timeout after 5 minutes",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000 + 60000).toISOString(),
    completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000 + 6 * 60000).toISOString(),
  },
];

export const mockSessionLogs = {
  "session-001": [
    { id: "log-1", sessionId: "session-001", level: "info", phase: "cloning", message: "Cloning repository...", progress: 10, timestamp: new Date(Date.now() - 14 * 60 * 1000).toISOString() },
    { id: "log-2", sessionId: "session-001", level: "info", phase: "cloning", message: "Repository cloned successfully", progress: 20, timestamp: new Date(Date.now() - 13 * 60 * 1000).toISOString() },
    { id: "log-3", sessionId: "session-001", level: "info", phase: "analyzing", message: "Starting Claude agent...", progress: 30, timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString() },
    { id: "log-4", sessionId: "session-001", level: "info", phase: "analyzing", message: "Injecting issue context...", progress: 40, timestamp: new Date(Date.now() - 11 * 60 * 1000).toISOString() },
    { id: "log-5", sessionId: "session-001", level: "info", phase: "analyzing", message: "Analyzing codebase...", progress: 50, timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
  ],
  "session-002": [
    { id: "log-1", sessionId: "session-002", level: "info", phase: "cloning", message: "Cloning repository...", progress: 10, timestamp: new Date(Date.now() - 44 * 60 * 1000).toISOString() },
    { id: "log-2", sessionId: "session-002", level: "info", phase: "cloning", message: "Repository cloned successfully", progress: 20, timestamp: new Date(Date.now() - 43 * 60 * 1000).toISOString() },
    { id: "log-3", sessionId: "session-002", level: "info", phase: "analyzing", message: "Starting Claude agent...", progress: 30, timestamp: new Date(Date.now() - 42 * 60 * 1000).toISOString() },
    { id: "log-4", sessionId: "session-002", level: "info", phase: "analyzing", message: "Analysis complete", progress: 70, timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString() },
    { id: "log-5", sessionId: "session-002", level: "info", phase: "review", message: "Ready for review - 2 suggestions", progress: 80, timestamp: new Date(Date.now() - 34 * 60 * 1000).toISOString() },
  ],
  "session-003": [
    { id: "log-1", sessionId: "session-003", level: "info", phase: "cloning", message: "Cloning repository...", progress: 10, timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
    { id: "log-2", sessionId: "session-003", level: "info", phase: "analyzing", message: "Analysis complete", progress: 70, timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString() },
    { id: "log-3", sessionId: "session-003", level: "info", phase: "review", message: "Ready for review", progress: 80, timestamp: new Date(Date.now() - 85 * 60 * 1000).toISOString() },
    { id: "log-4", sessionId: "session-003", level: "info", phase: "approved", message: "Fix approved by gmackie", progress: 90, timestamp: new Date(Date.now() - 32 * 60 * 1000).toISOString() },
    { id: "log-5", sessionId: "session-003", level: "info", phase: "pr_creation", message: "Created PR #42", progress: 100, timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
  ],
  "session-004": [
    { id: "log-1", sessionId: "session-004", level: "info", phase: "cloning", message: "Cloning repository...", progress: 10, timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
    { id: "log-2", sessionId: "session-004", level: "info", phase: "analyzing", message: "Starting Claude agent...", progress: 30, timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000 + 2 * 60000).toISOString() },
    { id: "log-3", sessionId: "session-004", level: "error", phase: "analyzing", message: "Agent timeout after 5 minutes", progress: 0, timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000 + 6 * 60000).toISOString() },
  ],
};

export const mockStats = {
  total: 4,
  pending: 1,
  inReview: 1,
  completed: 1,
  failed: 1,
  successRate: 50,
  last7Days: 3,
};

export function getMockSession(sessionId: string) {
  return mockAiDevSessions.find((s) => s.id === sessionId);
}

export function getMockSessionLogs(sessionId: string) {
  return mockSessionLogs[sessionId as keyof typeof mockSessionLogs] || [];
}

export function getActiveMockSessions() {
  return mockAiDevSessions.filter((s) =>
    ["pending", "cloning", "analyzing", "fixing", "testing", "review"].includes(s.status)
  );
}

/**
 * Helper to create mock fetch responses
 */
export function createMockFetchResponse<T>(data: T, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

/**
 * Setup mock fetch for issues API
 */
export function setupIssuesMock() {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes("/api/integrations/sentry")) {
      return Promise.resolve(
        createMockFetchResponse({ issues: mockSentryIssues })
      );
    }
    if (url.includes("/api/ai-dev") && url.includes("action=active")) {
      return Promise.resolve(
        createMockFetchResponse({ sessions: getActiveMockSessions() })
      );
    }
    return Promise.resolve(createMockFetchResponse({ error: "Not found" }, 404));
  });
}

/**
 * Setup mock fetch for AI sessions API
 */
export function setupSessionsMock() {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes("/api/ai-dev") && url.includes("action=list")) {
      return Promise.resolve(
        createMockFetchResponse({ sessions: mockAiDevSessions })
      );
    }
    if (url.includes("/api/ai-dev") && url.includes("action=stats")) {
      return Promise.resolve(createMockFetchResponse(mockStats));
    }
    if (url.includes("/api/ai-dev") && url.includes("action=get")) {
      const sessionIdMatch = url.match(/sessionId=([^&]+)/);
      const sessionId = sessionIdMatch?.[1];
      const session = getMockSession(sessionId || "");
      if (session) {
        return Promise.resolve(createMockFetchResponse({ session }));
      }
      return Promise.resolve(
        createMockFetchResponse({ error: "Session not found" }, 404)
      );
    }
    if (url.includes("/api/ai-dev") && url.includes("action=logs")) {
      const sessionIdMatch = url.match(/sessionId=([^&]+)/);
      const sessionId = sessionIdMatch?.[1];
      const logs = getMockSessionLogs(sessionId || "");
      return Promise.resolve(createMockFetchResponse({ logs }));
    }
    return Promise.resolve(createMockFetchResponse({ error: "Not found" }, 404));
  });
}

/**
 * Setup mock fetch for session detail
 */
export function setupSessionDetailMock(sessionId: string) {
  const session = getMockSession(sessionId);
  const logs = getMockSessionLogs(sessionId);

  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes("/api/ai-dev") && url.includes("action=get")) {
      if (session) {
        return Promise.resolve(createMockFetchResponse({ session }));
      }
      return Promise.resolve(
        createMockFetchResponse({ error: "Session not found" }, 404)
      );
    }
    if (url.includes("/api/ai-dev") && url.includes("action=logs")) {
      return Promise.resolve(createMockFetchResponse({ logs }));
    }
    return Promise.resolve(createMockFetchResponse({ error: "Not found" }, 404));
  });
}
