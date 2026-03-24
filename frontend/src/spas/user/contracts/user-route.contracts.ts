import { z } from "zod";

import {
  USER_CREDENTIALS_TAB_VALUES,
  USER_TOP_TAB_VALUES,
  type UserCredentialsTab,
  type UserTopTab,
} from "../routes/user-route-paths.js";

const positiveIntegerSchema = z.coerce.number().int().positive();
const userTopTabSchema = z.enum(USER_TOP_TAB_VALUES);
const userCredentialsTabSchema = z.enum(USER_CREDENTIALS_TAB_VALUES);

function parsePositiveIntegerSearchParameter(
  searchParameters: URLSearchParams,
  key: string,
): number | null {
  const rawValue = searchParameters.get(key);
  if (rawValue === null) {
    return null;
  }

  const parseResult = positiveIntegerSchema.safeParse(rawValue);
  return parseResult.success ? parseResult.data : null;
}

export function parseUserIdFromSearchParameters(searchParameters: URLSearchParams): number | null {
  return parsePositiveIntegerSearchParameter(searchParameters, "userId");
}

export function parseUserTopTab(searchParameters: URLSearchParams): UserTopTab {
  const rawValue = searchParameters.get("tab");
  const parseResult = userTopTabSchema.safeParse(rawValue);
  return parseResult.success ? parseResult.data : "details";
}

export function parseUserCredentialsTab(searchParameters: URLSearchParams): UserCredentialsTab {
  const rawValue = searchParameters.get("credentialsTab");
  const parseResult = userCredentialsTabSchema.safeParse(rawValue);
  return parseResult.success ? parseResult.data : "password";
}
