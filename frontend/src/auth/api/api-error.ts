import type { ZodIssue } from "zod";

export type ApiErrorKind = "http" | "network" | "validation";

interface ApiErrorOptions {
  cause?: unknown;
  issues?: ZodIssue[];
  responseBody?: string;
  status?: number;
}

export class ApiError extends Error {
  readonly cause: unknown;
  readonly issues: ZodIssue[];
  readonly kind: ApiErrorKind;
  readonly responseBody: string | undefined;
  readonly status: number | undefined;

  constructor(
    kind: ApiErrorKind,
    message: string,
    options: ApiErrorOptions = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.cause = options.cause;
    this.issues = options.issues ?? [];
    this.kind = kind;
    this.responseBody = options.responseBody;
    this.status = options.status;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
