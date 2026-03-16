import type { ZodIssue } from "zod";

export type ApiErrorKind = "http" | "network" | "validation";

interface ApiErrorOptions {
  cause?: unknown;
  issues?: ZodIssue[];
  responseBody?: string;
  status?: number;
}

interface BlockingObjectPayload {
  id?: number;
  kind?: string;
  reason?: string;
}

interface HttpErrorPayload {
  blockingObjects?: BlockingObjectPayload[];
  message?: string;
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

function parseHttpErrorPayload(responseBody: string): HttpErrorPayload | null {
  try {
    return JSON.parse(responseBody) as HttpErrorPayload;
  } catch {
    return null;
  }
}

function formatBlockingObject(
  blockingObject: BlockingObjectPayload | undefined,
): string | null {
  if (
    !blockingObject ||
    typeof blockingObject.kind !== "string" ||
    typeof blockingObject.id !== "number" ||
    typeof blockingObject.reason !== "string"
  ) {
    return null;
  }

  return `${blockingObject.kind} #${blockingObject.id} (${blockingObject.reason})`;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!isApiError(error) || error.kind !== "http" || !error.responseBody) {
    return fallback;
  }

  const parsedPayload = parseHttpErrorPayload(error.responseBody);
  if (!parsedPayload?.message) {
    return error.responseBody;
  }

  const blockingObjectLabel = formatBlockingObject(parsedPayload.blockingObjects?.[0]);
  if (!blockingObjectLabel) {
    return parsedPayload.message;
  }

  return `${parsedPayload.message} Blocked by ${blockingObjectLabel}.`;
}
