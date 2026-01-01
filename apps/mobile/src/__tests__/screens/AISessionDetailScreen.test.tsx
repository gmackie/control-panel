import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { AISessionDetailScreen } from "../../screens/AISessionDetailScreen";
import {
  mockAiDevSessions,
  mockSessionLogs,
  setupSessionDetailMock,
  createMockFetchResponse,
  getMockSession,
  getMockSessionLogs,
} from "../mocks/ai-dev-data";

// Mock the route params
const mockRoute = {
  params: { sessionId: "session-001" },
};

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native");
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      setOptions: jest.fn(),
    }),
    useRoute: () => mockRoute,
    useFocusEffect: jest.fn((callback) => callback()),
  };
});

jest.mock("../../hooks/useBiometricAuth", () => ({
  useBiometricAuth: () => ({
    authenticate: jest.fn().mockResolvedValue(true),
  }),
}));

describe("AISessionDetailScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRoute.params = { sessionId: "session-001" };
    setupSessionDetailMock("session-001");
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Loading State", () => {
    it("should show loading indicator initially", async () => {
      // Delay the response to catch loading state
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(createMockFetchResponse({ session: null })), 100))
      );

      render(<AISessionDetailScreen />);

      expect(screen.getByText("Loading session...")).toBeTruthy();
    });
  });

  describe("Session Header", () => {
    it("should display session title", async () => {
      render(<AISessionDetailScreen />);

      const session = getMockSession("session-001");

      await waitFor(() => {
        expect(screen.getByText(session!.issueTitle)).toBeTruthy();
      });
    });

    it("should display status badge", async () => {
      render(<AISessionDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText("Analyzing Issue")).toBeTruthy();
      });
    });

    it("should display issue source", async () => {
      render(<AISessionDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText("sentry")).toBeTruthy();
      });
    });

    it("should display agent type", async () => {
      render(<AISessionDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText("claude")).toBeTruthy();
      });
    });

    it("should display application name", async () => {
      render(<AISessionDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText("my-app")).toBeTruthy();
      });
    });
  });

  describe("Progress Section", () => {
    it("should show progress for active sessions", async () => {
      render(<AISessionDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText("Progress")).toBeTruthy();
      });
    });

    it("should show progress steps", async () => {
      render(<AISessionDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText("Pending")).toBeTruthy();
        expect(screen.getByText("Cloning")).toBeTruthy();
        expect(screen.getByText("Analyzing")).toBeTruthy();
        expect(screen.getByText("Fixing")).toBeTruthy();
        expect(screen.getByText("Testing")).toBeTruthy();
        expect(screen.getByText("Review")).toBeTruthy();
      });
    });
  });

  describe("Details Section", () => {
    it("should display repository URL", async () => {
      render(<AISessionDetailScreen />);

      const session = getMockSession("session-001");

      await waitFor(() => {
        expect(screen.getByText("Repository")).toBeTruthy();
        expect(screen.getByText(session!.repositoryUrl)).toBeTruthy();
      });
    });

    it("should display branch name", async () => {
      render(<AISessionDetailScreen />);

      const session = getMockSession("session-001");

      await waitFor(() => {
        expect(screen.getByText("Branch")).toBeTruthy();
        expect(screen.getByText(session!.branch)).toBeTruthy();
      });
    });

    it("should display created date", async () => {
      render(<AISessionDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText("Created")).toBeTruthy();
      });
    });
  });

  describe("Activity Logs", () => {
    it("should display activity logs", async () => {
      render(<AISessionDetailScreen />);

      const logs = getMockSessionLogs("session-001");

      await waitFor(() => {
        expect(screen.getByText("Activity Log")).toBeTruthy();
        expect(screen.getByText(logs[0].message)).toBeTruthy();
      });
    });

    it("should show log messages", async () => {
      render(<AISessionDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText("Cloning repository...")).toBeTruthy();
      });
    });
  });

  describe("Action Buttons for Active Session", () => {
    it("should show Check Status button for active sessions", async () => {
      render(<AISessionDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText("Check Status")).toBeTruthy();
      });
    });

    it("should show Cancel Session button for active sessions", async () => {
      render(<AISessionDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText("Cancel Session")).toBeTruthy();
      });
    });
  });

  describe("Review Session", () => {
    beforeEach(() => {
      mockRoute.params = { sessionId: "session-002" };
      setupSessionDetailMock("session-002");
    });

    it("should show review section for sessions in review status", async () => {
      render(<AISessionDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText("Review Required")).toBeTruthy();
      });
    });

    it("should show approve button for review sessions", async () => {
      render(<AISessionDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText("Approve & Create PR")).toBeTruthy();
      });
    });

    it("should show reject button for review sessions", async () => {
      render(<AISessionDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText("Reject")).toBeTruthy();
      });
    });

    it("should show review description", async () => {
      render(<AISessionDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText(/AI has analyzed the issue/)).toBeTruthy();
      });
    });
  });

  describe("Approved Session with PR", () => {
    beforeEach(() => {
      mockRoute.params = { sessionId: "session-003" };
      setupSessionDetailMock("session-003");
    });

    it("should show PR section for approved sessions", async () => {
      render(<AISessionDetailScreen />);

      const session = getMockSession("session-003");

      await waitFor(() => {
        expect(screen.getByText(session!.prTitle!)).toBeTruthy();
      });
    });

    it("should display PR title", async () => {
      render(<AISessionDetailScreen />);

      const session = getMockSession("session-003");

      await waitFor(() => {
        expect(screen.getByText(session!.prTitle!)).toBeTruthy();
      });
    });

    it("should display completed timestamp", async () => {
      render(<AISessionDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText("Completed")).toBeTruthy();
      });
    });
  });

  describe("Failed Session", () => {
    beforeEach(() => {
      mockRoute.params = { sessionId: "session-004" };
      setupSessionDetailMock("session-004");
    });

    it("should show error message for failed sessions", async () => {
      render(<AISessionDetailScreen />);

      const session = getMockSession("session-004");

      await waitFor(() => {
        expect(screen.getAllByText(session!.errorMessage!).length).toBeGreaterThan(0);
      });
    });

    it("should not show action buttons for failed sessions", async () => {
      render(<AISessionDetailScreen />);

      await waitFor(() => {
        expect(screen.queryByText("Check Status")).toBeNull();
        expect(screen.queryByText("Cancel Session")).toBeNull();
      });
    });
  });

  describe("Actions", () => {
    it("should handle check status action", async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string, options?: RequestInit) => {
        if (options?.method === "POST") {
          return Promise.resolve(
            createMockFetchResponse({
              session: getMockSession("session-001"),
              bobStatus: { phase: "analyzing", progress: 60 },
            })
          );
        }
        if (url.includes("action=get")) {
          return Promise.resolve(createMockFetchResponse({ session: getMockSession("session-001") }));
        }
        if (url.includes("action=logs")) {
          return Promise.resolve(createMockFetchResponse({ logs: getMockSessionLogs("session-001") }));
        }
        return Promise.resolve(createMockFetchResponse({ error: "Not found" }, 404));
      });

      render(<AISessionDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText("Check Status")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Check Status"));

      // Verify POST was called
      await waitFor(() => {
        const postCalls = (global.fetch as jest.Mock).mock.calls.filter(
          (call: unknown[]) => call[1]?.method === "POST"
        );
        expect(postCalls.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Session Not Found", () => {
    it("should handle session not found gracefully", async () => {
      mockRoute.params = { sessionId: "non-existent" };

      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve(createMockFetchResponse({ error: "Session not found" }, 404))
      );

      render(<AISessionDetailScreen />);

      // Should still render without crashing
      await waitFor(() => {
        expect(screen.getByText("Loading session...")).toBeTruthy();
      });
    });
  });

  describe("Auto-refresh for Active Sessions", () => {
    it.skip("should auto-refresh for active sessions", async () => {
      jest.useFakeTimers();

      render(<AISessionDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText(getMockSession("session-001")!.issueTitle)).toBeTruthy();
      });

      const initialCallCount = (global.fetch as jest.Mock).mock.calls.length;

      // Advance timer by refresh interval (5 seconds)
      jest.advanceTimersByTime(5000);

      await waitFor(() => {
        expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });

      jest.useRealTimers();
    });
  });
});
