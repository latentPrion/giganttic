const MENTION_PATTERN =
  /(?<![\w@])@(?:\[([^\]\r\n]+)\]|([A-Za-z0-9_.-]+))/g;

function pushUniqueMention(values: string[], nextValue: string): void {
  const trimmedValue = nextValue.trim();
  if (trimmedValue.length === 0 || values.includes(trimmedValue)) {
    return;
  }

  values.push(trimmedValue);
}

function collectMentions(body: string, values: string[]): void {
  for (const match of body.matchAll(MENTION_PATTERN)) {
    const candidate = match[1] ?? match[2];
    if (!candidate) {
      continue;
    }
    pushUniqueMention(values, candidate);
  }
}

export function extractMentionUsernames(body: string): string[] {
  const mentions: string[] = [];
  collectMentions(body, mentions);
  return mentions;
}
