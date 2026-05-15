import { Data, Effect } from "effect";

// Centralized error types using Effect.Data.TaggedEnum

export class NetworkError extends Data.TaggedError("NetworkError")<{
  readonly message: string;
  readonly cause?: unknown;
  readonly timestamp: number;
}> {}

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly message: string;
  readonly cause?: unknown;
  readonly timestamp: number;
  readonly query?: string;
}> {}

export class AuthError extends Data.TaggedError("AuthError")<{
  readonly message: string;
  readonly cause?: unknown;
  readonly timestamp: number;
  readonly code?: string;
}> {}

export class GitError extends Data.TaggedError("GitError")<{
  readonly message: string;
  readonly cause?: unknown;
  readonly timestamp: number;
  readonly gitCommand?: string;
}> {}

export class ConfigError extends Data.TaggedError("ConfigError")<{
  readonly message: string;
  readonly cause?: unknown;
  readonly timestamp: number;
  readonly key?: string;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string;
  readonly cause?: unknown;
  readonly timestamp: number;
  readonly fields?: Record<string, string>;
}> {}

// Union type for all server errors
export type ServerError =
  | NetworkError
  | DatabaseError
  | AuthError
  | GitError
  | ConfigError
  | ValidationError;

// Map error tags to HTTP status codes
const statusCodeMap: Record<string, number> = {
  NetworkError: 503,
  DatabaseError: 500,
  AuthError: 401,
  GitError: 500,
  ConfigError: 500,
  ValidationError: 400,
};

// Convert error to HTTP response
export const errorToResponse = (error: ServerError) => {
  const status = statusCodeMap[error._tag] || 500;
  return {
    status,
    body: {
      error: error._tag,
      message: error.message,
      timestamp: error.timestamp,
      ...(error._tag === "ValidationError" && { fields: (error as ValidationError).fields }),
      ...(error._tag === "AuthError" && { code: (error as AuthError).code }),
    },
  };
};

// Convert error to structured log entry
export const errorToLog = (error: ServerError) => ({
  level: "error" as const,
  tag: error._tag,
  message: error.message,
  timestamp: new Date(error.timestamp).toISOString(),
  cause: error.cause instanceof Error ? error.cause.message : String(error.cause || ""),
  ...(("query" in error) && { query: (error as DatabaseError).query }),
  ...(("gitCommand" in error) && { gitCommand: (error as GitError).gitCommand }),
  ...(("key" in error) && { key: (error as ConfigError).key }),
});

// Helper to create errors with current timestamp
const ts = () => Date.now();

export const createNetworkError = (message: string, cause?: unknown) =>
  new NetworkError({ message, cause, timestamp: ts() });

export const createDatabaseError = (message: string, cause?: unknown, query?: string) =>
  new DatabaseError({ message, cause, timestamp: ts(), query });

export const createAuthError = (message: string, cause?: unknown, code?: string) =>
  new AuthError({ message, cause, timestamp: ts(), code });

export const createGitError = (message: string, cause?: unknown, gitCommand?: string) =>
  new GitError({ message, cause, timestamp: ts(), gitCommand });

export const createConfigError = (message: string, cause?: unknown, key?: string) =>
  new ConfigError({ message, cause, timestamp: ts(), key });

export const createValidationError = (message: string, fields?: Record<string, string>) =>
  new ValidationError({ message, timestamp: ts(), fields });
