export type ProviderType = 'git' | 'deploy' | 'database' | 'integration';

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  enabled: boolean;
}

export interface ProviderError extends Error {
  code: string;
  provider: string;
  statusCode?: number;
  retryable?: boolean;
  originalError?: Error;
}

export function createProviderError(
  provider: string,
  code: string,
  message: string,
  options?: { statusCode?: number; retryable?: boolean; cause?: Error }
): ProviderError {
  const error = new Error(message) as ProviderError;
  error.name = 'ProviderError';
  error.code = code;
  error.provider = provider;
  error.statusCode = options?.statusCode;
  error.retryable = options?.retryable ?? false;
  error.originalError = options?.cause;
  return error;
}

export interface PaginationOptions {
  page?: number;
  perPage?: number;
  cursor?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    nextCursor?: string;
  };
}

export interface Actor {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
}

export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

export type Environment = 'production' | 'staging' | 'preview' | 'development';

export interface EnvVar {
  key: string;
  value: string;
  target?: Environment[];
  isSecret?: boolean;
}
