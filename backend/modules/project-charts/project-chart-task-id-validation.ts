import { BadRequestException } from "@nestjs/common";

import {
  createDuplicateTaskIdIssue,
  createInvalidProjectChartXmlIssue,
  createMissingTaskIdIssue,
  validateProjectChartTaskIdValue,
  type ProjectChartTaskIdValidationIssue,
} from "../../../common/project-chart/project-chart-task-id-validation.js";

const TASK_TAG_NAME = "task";

interface ParsedProjectChartTag {
  attributesText: string;
  isClosing: boolean;
  isSelfClosing: boolean;
  name: string;
  nextIndex: number;
}

function isNameCharacter(character: string): boolean {
  return /[A-Za-z0-9:_-]/.test(character);
}

function findTagCloseIndex(xml: string, startIndex: number): number {
  let quoteCharacter: '"' | "'" | null = null;

  for (let index = startIndex; index < xml.length; index += 1) {
    const character = xml[index];
    if (quoteCharacter) {
      if (character === quoteCharacter) {
        quoteCharacter = null;
      }
      continue;
    }

    if (character === "\"" || character === "'") {
      quoteCharacter = character;
      continue;
    }

    if (character === ">") {
      return index;
    }
  }

  return -1;
}

function parseElementTag(xml: string, startIndex: number): ParsedProjectChartTag {
  const closeIndex = findTagCloseIndex(xml, startIndex + 1);
  if (closeIndex < 0) {
    throw new BadRequestException(createInvalidProjectChartXmlIssue().message);
  }

  const rawTagBody = xml.slice(startIndex + 1, closeIndex).trim();
  const isClosing = rawTagBody.startsWith("/");
  const normalizedTagBody = isClosing
    ? rawTagBody.slice(1).trim()
    : rawTagBody;
  const isSelfClosing = !isClosing && normalizedTagBody.endsWith("/");
  const withoutSelfClosingSuffix = isSelfClosing
    ? normalizedTagBody.slice(0, -1).trim()
    : normalizedTagBody;

  let nameEndIndex = 0;
  while (
    nameEndIndex < withoutSelfClosingSuffix.length &&
    isNameCharacter(withoutSelfClosingSuffix[nameEndIndex]!)
  ) {
    nameEndIndex += 1;
  }

  const name = withoutSelfClosingSuffix.slice(0, nameEndIndex);
  if (!name) {
    throw new BadRequestException(createInvalidProjectChartXmlIssue().message);
  }

  return {
    attributesText: withoutSelfClosingSuffix.slice(nameEndIndex).trim(),
    isClosing,
    isSelfClosing,
    name,
    nextIndex: closeIndex + 1,
  };
}

function consumeDelimitedBlock(
  xml: string,
  startIndex: number,
  opening: string,
  closing: string,
): number {
  if (!xml.startsWith(opening, startIndex)) {
    return startIndex;
  }

  const endIndex = xml.indexOf(closing, startIndex + opening.length);
  if (endIndex < 0) {
    throw new BadRequestException(createInvalidProjectChartXmlIssue().message);
  }

  return endIndex + closing.length;
}

function extractAttributeValue(
  attributesText: string,
  attributeName: string,
): string | null {
  const attributePattern = new RegExp(
    `(?:^|\\s)${attributeName}\\s*=\\s*(["'])(.*?)\\1`,
    "s",
  );
  const match = attributePattern.exec(attributesText);
  return match?.[2] ?? null;
}

function validateTaskIdOrThrow(taskId: string): string {
  const issue = validateProjectChartTaskIdValue(taskId);
  if (issue) {
    throw new BadRequestException(issue.message);
  }

  return taskId;
}

function throwIssue(issue: ProjectChartTaskIdValidationIssue): never {
  throw new BadRequestException(issue.message);
}

function scanProjectChartTaskIds(xml: string): string[] {
  const taskIds: string[] = [];
  const stack: string[] = [];
  const seenTaskIds = new Set<string>();
  let index = 0;

  while (index < xml.length) {
    const nextMarkupIndex = xml.indexOf("<", index);
    if (nextMarkupIndex < 0) {
      break;
    }

    index = nextMarkupIndex;

    if (xml.startsWith("<!--", index)) {
      index = consumeDelimitedBlock(xml, index, "<!--", "-->");
      continue;
    }

    if (xml.startsWith("<![CDATA[", index)) {
      index = consumeDelimitedBlock(xml, index, "<![CDATA[", "]]>");
      continue;
    }

    if (xml.startsWith("<?", index)) {
      index = consumeDelimitedBlock(xml, index, "<?", "?>");
      continue;
    }

    if (xml.startsWith("<!", index)) {
      throwIssue(createInvalidProjectChartXmlIssue());
    }

    const tag = parseElementTag(xml, index);
    index = tag.nextIndex;

    if (tag.isClosing) {
      const expectedName = stack.pop();
      if (expectedName !== tag.name) {
        throwIssue(createInvalidProjectChartXmlIssue());
      }
      continue;
    }

    if (tag.name === TASK_TAG_NAME) {
      const rawTaskId = extractAttributeValue(tag.attributesText, "id");
      if (rawTaskId === null) {
        throwIssue(createMissingTaskIdIssue());
      }

      const canonicalTaskId = validateTaskIdOrThrow(rawTaskId);
      if (seenTaskIds.has(canonicalTaskId)) {
        throwIssue(createDuplicateTaskIdIssue(canonicalTaskId));
      }

      seenTaskIds.add(canonicalTaskId);
      taskIds.push(canonicalTaskId);
    }

    if (!tag.isSelfClosing) {
      stack.push(tag.name);
    }
  }

  if (stack.length > 0) {
    throwIssue(createInvalidProjectChartXmlIssue());
  }

  return taskIds;
}

function collectBestEffortTaskIds(xml: string): string[] {
  const taskTagPattern = /<task\b[^>]*\bid\s*=\s*(["'])(.*?)\1/gs;
  const taskIds: string[] = [];
  const seenTaskIds = new Set<string>();

  for (const match of xml.matchAll(taskTagPattern)) {
    const taskId = match[2] ?? "";
    const issue = validateProjectChartTaskIdValue(taskId);
    if (issue) {
      continue;
    }
    if (seenTaskIds.has(taskId)) {
      continue;
    }
    seenTaskIds.add(taskId);
    taskIds.push(taskId);
  }

  return taskIds;
}

export function validateProjectChartTaskIdsOrThrow(xml: string): string[] {
  return scanProjectChartTaskIds(xml);
}

export function collectProjectChartTaskIdsBestEffort(xml: string): string[] {
  try {
    return scanProjectChartTaskIds(xml);
  } catch {
    return collectBestEffortTaskIds(xml);
  }
}
