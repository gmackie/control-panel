export interface ApiError extends Error {
  statusCode: number;
  code: string;
  details?: any;
  cause?: Error;
}

export class ValidationError extends Error implements ApiError {
  statusCode = 400;
  code = 'VALIDATION_ERROR';
  
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error implements ApiError {
  statusCode = 401;
  code = 'AUTHENTICATION_ERROR';
  
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error implements ApiError {
  statusCode = 403;
  code = 'AUTHORIZATION_ERROR';
  
  constructor(message: string = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends Error implements ApiError {
  statusCode = 404;
  code = 'NOT_FOUND';
  
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error implements ApiError {
  statusCode = 409;
  code = 'CONFLICT';
  
  constructor(message: string = 'Resource conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends Error implements ApiError {
  statusCode = 429;
  code = 'RATE_LIMIT_EXCEEDED';
  
  constructor(
    message: string = 'Rate limit exceeded',
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class InternalServerError extends Error implements ApiError {
  statusCode = 500;
  code = 'INTERNAL_SERVER_ERROR';
  
  constructor(message: string = 'Internal server error', public cause?: Error) {
    super(message);
    this.name = 'InternalServerError';
    this.cause = cause;
  }
}

export class ServiceUnavailableError extends Error implements ApiError {
  statusCode = 503;
  code = 'SERVICE_UNAVAILABLE';
  
  constructor(service: string = 'Service') {
    super(`${service} is currently unavailable`);
    this.name = 'ServiceUnavailableError';
  }
}

export class ExternalServiceError extends Error implements ApiError {
  statusCode = 502;
  code = 'EXTERNAL_SERVICE_ERROR';
  
  constructor(
    service: string,
    message?: string,
    public cause?: Error
  ) {
    super(message || `External service ${service} error`);
    this.name = 'ExternalServiceError';
    this.cause = cause;
  }
}

export function createApiErrorResponse(error: unknown): Response {
  let apiError: ApiError;
  
  if (error instanceof Error && 'statusCode' in error) {
    apiError = error as ApiError;
  } else if (error instanceof Error) {
    apiError = new InternalServerError(error.message, error);
  } else {
    apiError = new InternalServerError('Unknown error occurred');
  }

  const response = {
    error: {
      code: apiError.code,
      message: apiError.message,
      statusCode: apiError.statusCode,
      timestamp: new Date().toISOString(),
      details: apiError.details,
      ...(process.env.NODE_ENV === 'development' && {
        stack: apiError.stack,
        cause: apiError.cause?.message
      })
    }
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (apiError instanceof RateLimitError && apiError.retryAfter) {
    headers['Retry-After'] = apiError.retryAfter.toString();
  }

  return new Response(JSON.stringify(response), {
    status: apiError.statusCode,
    headers
  });
}

export function handleAsyncRoute<T extends any[]>(
  handler: (...args: T) => Promise<Response>
) {
  return async (...args: T): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error('API Route Error:', error);
      return createApiErrorResponse(error);
    }
  };
}

export function validateRequired<T extends Record<string, any>>(
  data: T,
  requiredFields: (keyof T)[]
): void {
  const missingFields = requiredFields.filter(field => !data[field]);
  
  if (missingFields.length > 0) {
    throw new ValidationError(
      `Missing required fields: ${missingFields.join(', ')}`,
      { missingFields }
    );
  }
}

export function validateStringLength(
  value: string,
  field: string,
  min?: number,
  max?: number
): void {
  if (min && value.length < min) {
    throw new ValidationError(`${field} must be at least ${min} characters long`);
  }
  if (max && value.length > max) {
    throw new ValidationError(`${field} must not exceed ${max} characters`);
  }
}

export function validateNumberRange(
  value: number,
  field: string,
  min?: number,
  max?: number
): void {
  if (min !== undefined && value < min) {
    throw new ValidationError(`${field} must be at least ${min}`);
  }
  if (max !== undefined && value > max) {
    throw new ValidationError(`${field} must not exceed ${max}`);
  }
}

export function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format');
  }
}

export function validateArray<T>(
  value: unknown,
  field: string,
  validator?: (item: T) => void
): T[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${field} must be an array`);
  }
  
  if (validator) {
    value.forEach((item, index) => {
      try {
        validator(item);
      } catch (error) {
        throw new ValidationError(
          `Invalid ${field}[${index}]: ${error instanceof Error ? error.message : 'validation failed'}`
        );
      }
    });
  }
  
  return value;
}

export function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        resolve(result);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === maxRetries) {
          break;
        }
        
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    reject(new InternalServerError(
      `Operation failed after ${maxRetries + 1} attempts: ${lastError?.message}`,
      lastError!
    ));
  });
}