import { ZodError } from "zod";
import { ConfigError } from "./config.js";
import { ApiError } from "./api-client.js";

export type ToolSuccessResponse<T> = {
  success: true;
  data: T;
  meta: {
    tool: string;
    durationMs: number;
    timestamp: string;
  };
};

export type ToolErrorResponse = {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
    statusCode?: number;
    retryable?: boolean;
  };
  meta: {
    tool: string;
    durationMs: number;
    timestamp: string;
  };
};

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFIG_ERROR"
  | "API_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INTERNAL_ERROR";

export type ToolResponse<T> = ToolSuccessResponse<T> | ToolErrorResponse;

export async function executeTool<T>(
  toolName: string,
  fn: () => Promise<T>
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  const startedAt = Date.now();
  const timestamp = new Date().toISOString();

  try {
    const data = await fn();
    const response: ToolSuccessResponse<T> = {
      success: true,
      data,
      meta: {
        tool: toolName,
        durationMs: Date.now() - startedAt,
        timestamp,
      },
    };
    return {
      content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
    };
  } catch (err) {
    const errorResponse = formatToolError(err, toolName, startedAt, timestamp);
    return {
      isError: true,
      content: [{ type: "text", text: JSON.stringify(errorResponse, null, 2) }],
    };
  }
}

function formatToolError(
  err: unknown,
  toolName: string,
  startedAt: number,
  timestamp: string
): ToolErrorResponse {
  const meta = {
    tool: toolName,
    durationMs: Date.now() - startedAt,
    timestamp,
  };

  if (err instanceof ZodError) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid input parameters",
        details: err.flatten(),
      },
      meta,
    };
  }

  if (err instanceof ConfigError) {
    return {
      success: false,
      error: {
        code: "CONFIG_ERROR",
        message: err.message,
        retryable: false,
      },
      meta,
    };
  }

  if (err instanceof ApiError) {
    const code = getCodeFromStatus(err.statusCode);
    return {
      success: false,
      error: {
        code,
        message: err.message,
        statusCode: err.statusCode,
        details: err.details,
        retryable: err.statusCode >= 500 || err.statusCode === 429,
      },
      meta,
    };
  }

  if (err instanceof NotFoundError) {
    return {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: err.message,
        details: err.details,
      },
      meta,
    };
  }

  if (err instanceof Error) {
    const isNetworkError =
      err.message.includes("fetch") ||
      err.message.includes("ECONNREFUSED") ||
      err.message.includes("ETIMEDOUT");

    return {
      success: false,
      error: {
        code: isNetworkError ? "API_ERROR" : "INTERNAL_ERROR",
        message: err.message,
        retryable: isNetworkError,
      },
      meta,
    };
  }

  return {
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
    meta,
  };
}

function getCodeFromStatus(statusCode: number): ErrorCode {
  if (statusCode === 401) return "UNAUTHORIZED";
  if (statusCode === 403) return "FORBIDDEN";
  if (statusCode === 404) return "NOT_FOUND";
  if (statusCode >= 400 && statusCode < 500) return "VALIDATION_ERROR";
  return "API_ERROR";
}

export class NotFoundError extends Error {
  code = "NOT_FOUND" as const;
  details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.details = details;
  }
}

export class ValidationError extends Error {
  code = "VALIDATION_ERROR" as const;
  details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.details = details;
  }
}
