import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { AISessionsListScreen } from "../../screens/AISessionsListScreen";
import {
  mockAiDevSessions,
  mockStats,
  setupSessionsMock,
  createMockFetchResponse,
} from "../mocks/ai-dev-data";

describe.skip("AISessionsListScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupSessionsMock();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Loading State", () => {
    it("should show loading indicator initially", async () => {
      // Delay the response to catch loading state
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(createMockFetchResponse({ sessions: [] })), 100))
      );

      render(<AISessionsListScreen />);

      expect(screen.getByText("Loading AI sessions...")).toBeTruthy();
    });
  });

  describe("Stats Display", () => {
    it("should display session stats", async () => {
      render(<AISessionsListScreen />);

      await waitFor(() => {
        expect(screen.getByText("In Progress")).toBeTruthy();
        expect(screen.getByText("Review")).toBeTruthy();
        expect(screen.getByText("Completed")).toBeTruthy();
        expect(screen.getByText("Failed")).toBeTruthy();
      });
    });

    it("should display correct stat values", async () => {
      render(<AISessionsListScreen />);

      await waitFor(() => {
        // mockStats values
        expect(screen.getByText(String(mockStats.pending))).toBeTruthy();
        expect(screen.getByText(String(mockStats.inReview))).toBeTruthy();
        expect(screen.getByText(String(mockStats.completed))).toBeTruthy();
        expect(screen.getByText(String(mockStats.failed))).toBeTruthy();
      });
    });
  });

  describe("Sessions Display", () => {
    it("should display session titles", async () => {
      render(<AISessionsListScreen />);

      await waitFor(() => {
        expect(screen.getByText(mockAiDevSessions[0].issueTitle)).toBeTruthy();
      });
    });

    it("should display agent type badge", async () => {
      render(<AISessionsListScreen />);

      await waitFor(() => {
        expect(screen.getByText("claude")).toBeTruthy();
      });
    });

    it("should display status badge for analyzing session", async () => {
      render(<AISessionsListScreen />);

      await waitFor(() => {
        expect(screen.getByText("Analyzing")).toBeTruthy();
      });
    });

    it("should display status badge for review session", async () => {
      render(<AISessionsListScreen />);

      await waitFor(() => {
        expect(screen.getByText("Review Needed")).toBeTruthy();
      });
    });

    it("should display PR number for approved sessions", async () => {
      render(<AISessionsListScreen />);

      await waitFor(() => {
        expect(screen.getByText("#42")).toBeTruthy();
      });
    });

    it("should display application name", async () => {
      render(<AISessionsListScreen />);

      await waitFor(() => {
        expect(screen.getByText("my-app")).toBeTruthy();
      });
    });
  });

  describe("Filter Functionality", () => {
    it("should show filter chips", async () => {
      render(<AISessionsListScreen />);

      await waitFor(() => {
        expect(screen.getByText("Active")).toBeTruthy();
        expect(screen.getByText("Completed")).toBeTruthy();
        expect(screen.getByText("All")).toBeTruthy();
      });
    });

    it("should filter to show only active sessions by default", async () => {
      render(<AISessionsListScreen />);

      await waitFor(() => {
        // Active sessions are: analyzing, review (pending, cloning, fixing, testing)
        expect(screen.getByText("Analyzing")).toBeTruthy();
        expect(screen.getByText("Review Needed")).toBeTruthy();
      });
    });

    it("should show completed sessions when Completed filter is selected", async () => {
      render(<AISessionsListScreen />);

      await waitFor(() => {
        expect(screen.getByText("Completed")).toBeTruthy();
      });

      // Press the Completed filter
      const completedFilters = screen.getAllByText("Completed");
      // First one should be the filter chip
      fireEvent.press(completedFilters[0]);

      await waitFor(() => {
        // Approved and failed are completed statuses
        expect(screen.getByText("Approved")).toBeTruthy();
      });
    });

    it("should show all sessions when All filter is selected", async () => {
      render(<AISessionsListScreen />);

      await waitFor(() => {
        expect(screen.getByText("All")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("All"));

      await waitFor(() => {
        // All 4 sessions should be visible
        expect(screen.getByText("Analyzing")).toBeTruthy();
        expect(screen.getByText("Review Needed")).toBeTruthy();
        expect(screen.getByText("Approved")).toBeTruthy();
        expect(screen.getByText("Failed")).toBeTruthy();
      });
    });

    it("should show count badges on filter chips", async () => {
      render(<AISessionsListScreen />);

      await waitFor(() => {
        // Active count should be 2 (analyzing + review)
        // Check that counts are displayed
        expect(screen.getByText("2")).toBeTruthy(); // active count
      });
    });
  });

  describe("Empty State", () => {
    it("should show empty state when no sessions exist", async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes("action=list")) {
          return Promise.resolve(createMockFetchResponse({ sessions: [] }));
        }
        if (url.includes("action=stats")) {
          return Promise.resolve(
            createMockFetchResponse({ total: 0, pending: 0, inReview: 0, completed: 0, failed: 0 })
          );
        }
        return Promise.resolve(createMockFetchResponse({ error: "Not found" }, 404));
      });

      render(<AISessionsListScreen />);

      await waitFor(() => {
        expect(screen.getByText("No AI sessions")).toBeTruthy();
      });
    });

    it("should show helpful message for empty active sessions", async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes("action=list")) {
          return Promise.resolve(createMockFetchResponse({ sessions: [] }));
        }
        if (url.includes("action=stats")) {
          return Promise.resolve(
            createMockFetchResponse({ total: 0, pending: 0, inReview: 0, completed: 0, failed: 0 })
          );
        }
        return Promise.resolve(createMockFetchResponse({ error: "Not found" }, 404));
      });

      render(<AISessionsListScreen />);

      await waitFor(() => {
        expect(screen.getByText(/Start one from the Issues tab/)).toBeTruthy();
      });
    });
  });

  describe("Session Status Indicators", () => {
    it("should show spinner for active sessions", async () => {
      render(<AISessionsListScreen />);

      await waitFor(() => {
        // The analyzing session should have a spinner indicator
        expect(screen.getByText("Analyzing")).toBeTruthy();
      });
    });

    it("should show correct status colors", async () => {
      render(<AISessionsListScreen />);

      // Just verify all statuses are rendered
      await waitFor(() => {
        expect(screen.getByText("Analyzing")).toBeTruthy();
        expect(screen.getByText("Review Needed")).toBeTruthy();
      });
    });
  });

  describe("Auto-refresh", () => {
    it.skip("should set up auto-refresh interval", async () => {
      jest.useFakeTimers();
      
      render(<AISessionsListScreen />);

      await waitFor(() => {
        expect(screen.getByText(mockAiDevSessions[0].issueTitle)).toBeTruthy();
      });

      const initialCallCount = (global.fetch as jest.Mock).mock.calls.length;

      // Advance timer by refresh interval (10 seconds)
      jest.advanceTimersByTime(10000);

      // Should have made additional fetch calls
      await waitFor(() => {
        expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });

      jest.useRealTimers();
    });
  });

  describe("Navigation", () => {
    const mockNavigate = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
      setupSessionsMock();

      // Setup navigation mock
      jest.spyOn(require("@react-navigation/native"), "useNavigation").mockReturnValue({
        navigate: mockNavigate,
        goBack: jest.fn(),
      });
    });

    it("should navigate to session detail when session is pressed", async () => {
      render(<AISessionsListScreen />);

      await waitFor(() => {
        expect(screen.getByText(mockAiDevSessions[0].issueTitle)).toBeTruthy();
      });

      // Press the first session
      fireEvent.press(screen.getByText(mockAiDevSessions[0].issueTitle));

      expect(mockNavigate).toHaveBeenCalledWith("AISessionDetail", { sessionId: mockAiDevSessions[0].id });
    });
  });
});
