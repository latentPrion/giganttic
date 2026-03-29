import { issueStatusCodes } from "../../../db/index.js";

const TASK_TAG_NAME = "task";
const TASK_STATUS_ATTRIBUTE = "ggtc_task_status";

interface ParsedProjectChartTag {
  attributesText: string;
  isClosing: boolean;
  isSelfClosing: boolean;
  name: string;
  nextIndex: number;
}

interface TaskFrame {
  status: string;
  taskId: string;
  titleParts: string[];
}

export interface ProjectChartTaskNotificationSnapshot {
  status: string;
  taskId: string;
  title: string;
}

export interface ProjectChartTaskStatusChange {
  next: ProjectChartTaskNotificationSnapshot;
  previous: ProjectChartTaskNotificationSnapshot;
}

function isNameCharacter(character: string): boolean {
  return /[A-Za-z0-9:_-]/.test(character);
}

function findTagCloseIndex(xml: string, startIndex: number): number {
  let quoteCharacter: "\"" | "'" | null = null;

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
    throw new Error("Project chart XML could not be parsed.");
  }

  const rawTagBody = xml.slice(startIndex + 1, closeIndex).trim();
  const isClosing = rawTagBody.startsWith("/");
  const normalizedTagBody = isClosing ? rawTagBody.slice(1).trim() : rawTagBody;
  const isSelfClosing = !isClosing && normalizedTagBody.endsWith("/");
  const withoutSelfClosingSuffix = isSelfClosing
    ? normalizedTagBody.slice(0, -1).trim()
    : normalizedTagBody;

  let nameEndIndex = 0;
  while (
    nameEndIndex < withoutSelfClosingSuffix.length
    && isNameCharacter(withoutSelfClosingSuffix[nameEndIndex]!)
  ) {
    nameEndIndex += 1;
  }

  const name = withoutSelfClosingSuffix.slice(0, nameEndIndex);
  if (!name) {
    throw new Error("Project chart XML could not be parsed.");
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
): { content: string; nextIndex: number } {
  if (!xml.startsWith(opening, startIndex)) {
    return { content: "", nextIndex: startIndex };
  }

  const endIndex = xml.indexOf(closing, startIndex + opening.length);
  if (endIndex < 0) {
    throw new Error("Project chart XML could not be parsed.");
  }

  return {
    content: xml.slice(startIndex + opening.length, endIndex),
    nextIndex: endIndex + closing.length,
  };
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

function getSnapshotTitle(frame: TaskFrame): string {
  return frame.titleParts.join("").trim();
}

function appendTaskText(
  elementStack: string[],
  taskStack: TaskFrame[],
  text: string,
): void {
  if (text.trim().length === 0) {
    return;
  }

  if (elementStack[elementStack.length - 1] !== TASK_TAG_NAME) {
    return;
  }

  taskStack[taskStack.length - 1]?.titleParts.push(text);
}

function finalizeTaskFrame(
  frame: TaskFrame | undefined,
  snapshots: Map<string, ProjectChartTaskNotificationSnapshot>,
): void {
  if (!frame) {
    return;
  }

  snapshots.set(frame.taskId, {
    status: frame.status,
    taskId: frame.taskId,
    title: getSnapshotTitle(frame),
  });
}

export function collectProjectChartTaskNotificationSnapshots(
  xml: string,
): Map<string, ProjectChartTaskNotificationSnapshot> {
  const snapshots = new Map<string, ProjectChartTaskNotificationSnapshot>();
  const elementStack: string[] = [];
  const taskStack: TaskFrame[] = [];
  let index = 0;

  while (index < xml.length) {
    const nextMarkupIndex = xml.indexOf("<", index);
    if (nextMarkupIndex < 0) {
      appendTaskText(elementStack, taskStack, xml.slice(index));
      break;
    }

    appendTaskText(elementStack, taskStack, xml.slice(index, nextMarkupIndex));
    index = nextMarkupIndex;

    if (xml.startsWith("<!--", index)) {
      index = consumeDelimitedBlock(xml, index, "<!--", "-->").nextIndex;
      continue;
    }

    if (xml.startsWith("<![CDATA[", index)) {
      const cdata = consumeDelimitedBlock(xml, index, "<![CDATA[", "]]>");
      appendTaskText(elementStack, taskStack, cdata.content);
      index = cdata.nextIndex;
      continue;
    }

    if (xml.startsWith("<?", index)) {
      index = consumeDelimitedBlock(xml, index, "<?", "?>").nextIndex;
      continue;
    }

    if (xml.startsWith("<!", index)) {
      throw new Error("Project chart XML could not be parsed.");
    }

    const tag = parseElementTag(xml, index);
    index = tag.nextIndex;

    if (tag.isClosing) {
      const closedElement = elementStack.pop();
      if (closedElement !== tag.name) {
        throw new Error("Project chart XML could not be parsed.");
      }
      if (tag.name === TASK_TAG_NAME) {
        finalizeTaskFrame(taskStack.pop(), snapshots);
      }
      continue;
    }

    if (tag.name === TASK_TAG_NAME) {
      const taskId = extractAttributeValue(tag.attributesText, "id");
      if (taskId) {
        const frame: TaskFrame = {
          status:
            extractAttributeValue(tag.attributesText, TASK_STATUS_ATTRIBUTE)
            ?? issueStatusCodes.open,
          taskId,
          titleParts: [],
        };
        if (tag.isSelfClosing) {
          finalizeTaskFrame(frame, snapshots);
        } else {
          taskStack.push(frame);
        }
      }
    }

    if (!tag.isSelfClosing) {
      elementStack.push(tag.name);
    }
  }

  return snapshots;
}

export function diffProjectChartTaskStatusChanges(
  previousXml: string | null,
  nextXml: string,
): ProjectChartTaskStatusChange[] {
  if (!previousXml) {
    return [];
  }

  const previousSnapshots = collectProjectChartTaskNotificationSnapshots(previousXml);
  const nextSnapshots = collectProjectChartTaskNotificationSnapshots(nextXml);
  const changes: ProjectChartTaskStatusChange[] = [];

  for (const [taskId, next] of nextSnapshots.entries()) {
    const previous = previousSnapshots.get(taskId);
    if (!previous || previous.status === next.status) {
      continue;
    }

    changes.push({ next, previous });
  }

  return changes;
}

