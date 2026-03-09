import type { ZodType } from "zod";

import { frontendConfig } from "../../config/frontend-config.js";
import { ApiError } from "./api-error.js";

const JSON_CONTENT_TYPE = "application/json";
const AUTH_HEADER_PREFIX = "Bearer";

interface JsonRequestOptions<TRequestSchema extends ZodType | undefined> {
  body?: TRequestSchema extends ZodType ? unknown : undefined;
  method: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
  path: string;
  requestSchema?: TRequestSchema;
  responseSchema: ZodType;
  token?: string;
}

function buildUrl(path: string): string {
  return `${frontendConfig.apiBaseUrl}${frontendConfig.routePrefix}${path}`;
}

function buildHeaders(token: string | undefined): HeadersInit {
  const headers: HeadersInit = {
    Accept: JSON_CONTENT_TYPE,
  };

  if (token) {
    headers.Authorization = `${AUTH_HEADER_PREFIX} ${token}`;
  }

  return headers;
}

async function readResponseBody(response: Response): Promise<string> {
  return await response.text();
}

function parseRequestBody<TRequestSchema extends ZodType | undefined>(
  requestSchema: TRequestSchema,
  body: unknown,
): string | undefined {
  if (!requestSchema) {
    return undefined;
  }

  const parsedBody = requestSchema.safeParse(body);
  if (!parsedBody.success) {
    throw new ApiError("validation", "Request payload failed validation", {
      issues: parsedBody.error.issues,
    });
  }

  return JSON.stringify(parsedBody.data);
}

function parseResponseBody<TResponse>(
  responseSchema: ZodType<TResponse>,
  responseBody: string,
): TResponse {
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(responseBody);
  } catch (error) {
    throw new ApiError("validation", "Response body was not valid JSON", {
      cause: error,
      responseBody,
    });
  }

  const parsedResponse = responseSchema.safeParse(parsedJson);
  if (!parsedResponse.success) {
    throw new ApiError("validation", "Response payload failed validation", {
      issues: parsedResponse.error.issues,
      responseBody,
    });
  }

  return parsedResponse.data;
}

export async function requestJson<TResponse, TRequestSchema extends ZodType | undefined>(
  options: JsonRequestOptions<TRequestSchema> & {
    responseSchema: ZodType<TResponse>;
  },
): Promise<TResponse> {
  const requestInit: RequestInit = {
    headers: buildHeaders(options.token),
    method: options.method,
  };

  if (options.requestSchema) {
    requestInit.body = parseRequestBody(options.requestSchema, options.body);
    requestInit.headers = {
      ...requestInit.headers,
      "Content-Type": JSON_CONTENT_TYPE,
    };
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(options.path), requestInit);
  } catch (error) {
    throw new ApiError("network", "Network request failed", {
      cause: error,
    });
  }

  const responseBody = await readResponseBody(response);
  if (!response.ok) {
    throw new ApiError("http", `HTTP ${response.status}`, {
      responseBody,
      status: response.status,
    });
  }

  return parseResponseBody(options.responseSchema, responseBody);
}
