interface AuthRequestMetadataInput {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string | undefined };
  trustProxy: boolean;
}

function readSingleHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeIpAddress(value: string | undefined): string {
  const candidateIp = value?.trim() ?? "";
  if (!candidateIp) {
    return "unknown";
  }

  return candidateIp.startsWith("::ffff:")
    ? candidateIp.slice("::ffff:".length)
    : candidateIp;
}

function resolveForwardedIpAddress(
  headers: Record<string, string | string[] | undefined>,
): string | undefined {
  const forwardedValue = readSingleHeaderValue(headers["x-forwarded-for"]);
  return forwardedValue?.split(",")[0]?.trim();
}

function resolveLocation(
  headers: Record<string, string | string[] | undefined>,
): string | null {
  return readSingleHeaderValue(headers["x-client-location"]) ?? null;
}

function resolveCandidateIpAddress(
  input: AuthRequestMetadataInput,
): string | undefined {
  if (input.trustProxy) {
    return resolveForwardedIpAddress(input.headers)
      || input.ip
      || input.socket?.remoteAddress;
  }

  return input.ip || input.socket?.remoteAddress;
}

export function extractAuthRequestMetadata(
  input: AuthRequestMetadataInput,
): { ipAddress: string; location: string | null } {
  return {
    ipAddress: normalizeIpAddress(resolveCandidateIpAddress(input)),
    location: resolveLocation(input.headers),
  };
}

