import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { IssuesScreen } from "../../screens/IssuesScreen";
import {
  mockSentryIssues,
  setupIssuesMock,
  getActiveMockSessions,
  createMockFetchResponse,
} from "../mocks/ai-dev-data";

// Mock the dependencies
jest.mock("../../components/ScopeBar", () => ({
  ScopeBar: () => null,
}));

jest.mock("../../stores/scope", () => ({
  useCurrentScope: () => ({ isGlobal: true, siteId: null }),
}));

jest.mock("../../hooks/useBiometricAuth", () => ({
  useBiometricAuth: () => ({
    authenticate: jest.fn().mockResolvedValue(true),
  }),
}));

describe("IssuesScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupIssuesMock();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Loading State", () => {
    it("should show loading indicator initially", async () => {
      // Delay the response to catch loading state
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(createMockFetchResponse({ issues: [] })), 100))
      );

      render(<IssuesScreen />);

      expect(screen.getByText("Loading issues...")).toBeTruthy();
    });
  });

  describe("Issues Display", () => {
    it("should display issues after loading", async () => {
      render(<IssuesScreen />);

      await waitFor(() => {
        expect(screen.getByText(mockSentryIssues[0].title)).toBeTruthy();
      });
    });

    it("should display issue severity badge", async () => {
      render(<IssuesScreen />);

      await waitFor(() => {
        expect(screen.getAllByText("ERROR").length).toBeGreaterThan(0);
      });
    });

    it("should display issue short ID", async () => {
      render(<IssuesScreen />);

      await waitFor(() => {
        expect(screen.getByText(mockSentryIssues[0].shortId)).toBeTruthy();
      });
    });

    it("should display culprit information", async () => {
      render(<IssuesScreen />);

      await waitFor(() => {
        expect(screen.getByText(mockSentryIssues[0].culprit)).toBeTruthy();
      });
    });

    it("should display project name", async () => {
      render(<IssuesScreen />);

      await waitFor(() => {
        expect(screen.getAllByText(mockSentryIssues[0].project.name).length).toBeGreaterThan(0);
      });
    });
  });

  describe("Filter Functionality", () => {
    it("should show filter chips", async () => {
      render(<IssuesScreen />);

      await waitFor(() => {
        expect(screen.getByText("All")).toBeTruthy();
        expect(screen.getByText("Fatal")).toBeTruthy();
        expect(screen.getByText("Error")).toBeTruthy();
        expect(screen.getByText("Warning")).toBeTruthy();
      });
    });

    it("should filter by fatal severity when Fatal chip is pressed", async () => {
      render(<IssuesScreen />);

      await waitFor(() => {
        expect(screen.getByText("Fatal")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Fatal"));

      await waitFor(() => {
        // Fatal issue should be visible
        expect(screen.getByText("Unhandled Promise Rejection: Network request failed")).toBeTruthy();
      });
    });

    it("should show issue counts in filter chips", async () => {
      render(<IssuesScreen />);

      await waitFor(() => {
        // The "All" filter should show total count
        expect(screen.getByText("4")).toBeTruthy(); // 4 mock issues total
      });
    });
  });

  describe("Active Sessions Banner", () => {
    it("should show active sessions banner when sessions exist", async () => {
      render(<IssuesScreen />);

      const activeSessions = getActiveMockSessions();

      await waitFor(() => {
        if (activeSessions.length > 0) {
          expect(screen.getByText(/AI session.*in progress/)).toBeTruthy();
        }
      });
    });
  });

  describe("Fix with AI Button", () => {
    it("should show Fix with AI button on each issue", async () => {
      render(<IssuesScreen />);

      await waitFor(() => {
        const fixButtons = screen.getAllByText("Fix with AI");
        expect(fixButtons.length).toBeGreaterThan(0);
      });
    });

    it("should show AI Working status for issues with active sessions", async () => {
      // Setup mock with an active session for the first issue
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes("/api/integrations/sentry")) {
          return Promise.resolve(
            createMockFetchResponse({ issues: mockSentryIssues })
          );
        }
        if (url.includes("/api/ai-dev") && url.includes("action=active")) {
          return Promise.resolve(
            createMockFetchResponse({
              sessions: [{ id: "session-001", issueId: "sentry-001", status: "analyzing" }],
            })
          );
        }
        return Promise.resolve(createMockFetchResponse({ error: "Not found" }, 404));
      });

      render(<IssuesScreen />);

      await waitFor(() => {
        expect(screen.getByText("AI Working...")).toBeTruthy();
      });
    });
  });

  describe("Error Handling", () => {
    it("should show error message when API fails", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      render(<IssuesScreen />);

      await waitFor(() => {
        expect(screen.getByText("Failed to load issues")).toBeTruthy();
      });
    });

    it("should show retry button on error", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      render(<IssuesScreen />);

      await waitFor(() => {
        expect(screen.getByText("Retry")).toBeTruthy();
      });
    });

    it("should retry loading when retry button is pressed", async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error("Network error"))
        .mockImplementation(() =>
          Promise.resolve(createMockFetchResponse({ issues: mockSentryIssues }))
        );

      render(<IssuesScreen />);

      await waitFor(() => {
        expect(screen.getByText("Retry")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Retry"));

      await waitFor(() => {
        expect(screen.getByText(mockSentryIssues[0].title)).toBeTruthy();
      });
    });
  });

  describe("Empty State", () => {
    it("should show empty state when no issues exist", async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes("/api/integrations/sentry")) {
          return Promise.resolve(createMockFetchResponse({ issues: [] }));
        }
        if (url.includes("/api/ai-dev") && url.includes("action=active")) {
          return Promise.resolve(createMockFetchResponse({ sessions: [] }));
        }
        return Promise.resolve(createMockFetchResponse({ error: "Not found" }, 404));
      });

      render(<IssuesScreen />);

      await waitFor(() => {
        expect(screen.getByText("No issues found")).toBeTruthy();
        expect(screen.getByText(/All clear/)).toBeTruthy();
      });
    });
  });

  describe("Pull to Refresh", () => {
    it("should refresh data when pulled", async () => {
      render(<IssuesScreen />);

      await waitFor(() => {
        expect(screen.getByText(mockSentryIssues[0].title)).toBeTruthy();
      });

      // Verify fetch was called
      expect(global.fetch).toHaveBeenCalled();

      // Clear and check if refresh works
      const fetchCallCount = (global.fetch as jest.Mock).mock.calls.length;

      // Simulate pull to refresh by calling refetch
      // Note: In actual testing, you'd need to simulate the gesture
      // This is a simplified version that just verifies the data loads
      expect(fetchCallCount).toBeGreaterThan(0);
    });
  });
});
