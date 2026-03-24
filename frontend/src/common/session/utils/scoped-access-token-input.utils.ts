const TOKEN_QUERY_PARAM_REGEX = /(?:[?&#])token=([^&#\s]+)/;

function tryParseTokenFromUrl(trimmed: string, baseUrl: string): string | null {
  try {
    const url = new URL(trimmed, baseUrl);
    const fromQuery = url.searchParams.get("token");
    if (fromQuery?.trim()) {
      return fromQuery.trim();
    }
  } catch {
    // Not a parseable URL with the given base.
  }
  return null;
}

function tryParseTokenWithRegex(trimmed: string): string | null {
  const match = trimmed.match(TOKEN_QUERY_PARAM_REGEX);
  if (!match?.[1]) {
    return null;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * Extracts a scoped access token from a pasted login URL, query fragment, or raw token string.
 */
export function parseScopedAccessTokenInput(raw: string, baseUrlForRelative: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const fromUrl = tryParseTokenFromUrl(trimmed, baseUrlForRelative);
  if (fromUrl) {
    return fromUrl;
  }

  const fromRegex = tryParseTokenWithRegex(trimmed);
  if (fromRegex?.trim()) {
    return fromRegex.trim();
  }

  return trimmed;
}
