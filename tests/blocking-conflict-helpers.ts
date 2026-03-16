import { expect } from "vitest";

export const BLOCKING_OBJECT_KINDS = [
  "organization",
  "project",
  "team",
] as const;

export const BLOCKING_OBJECT_REASONS = [
  "last_effective_organization_manager",
  "last_effective_project_manager",
  "last_effective_team_manager",
  "last_owner",
] as const;

export type BlockingObjectKind = (typeof BLOCKING_OBJECT_KINDS)[number];
export type BlockingObjectReason = (typeof BLOCKING_OBJECT_REASONS)[number];

export type BlockingObject = {
  id: number;
  kind: BlockingObjectKind;
  reason: BlockingObjectReason;
};

export type BlockingConflictPayload = {
  blockingObjects: BlockingObject[];
  error: string;
  message: string;
  statusCode: number;
};

function assertBlockingObject(
  blockingObject: BlockingObject | undefined,
  expected: {
    id?: number;
    kind?: BlockingObjectKind;
    reason?: BlockingObjectReason;
  },
) {
  expect(blockingObject).toBeDefined();
  expect(blockingObject?.id).toEqual(expect.any(Number));
  expect(BLOCKING_OBJECT_KINDS).toContain(blockingObject?.kind);
  expect(BLOCKING_OBJECT_REASONS).toContain(blockingObject?.reason);

  if (expected.id !== undefined) {
    expect(blockingObject?.id).toBe(expected.id);
  }
  if (expected.kind !== undefined) {
    expect(blockingObject?.kind).toBe(expected.kind);
  }
  if (expected.reason !== undefined) {
    expect(blockingObject?.reason).toBe(expected.reason);
  }
}

export function expectBlockingConflictPayload(
  payload: BlockingConflictPayload,
  expected: {
    firstBlockingObject?: {
      id?: number;
      kind?: BlockingObjectKind;
      reason?: BlockingObjectReason;
    };
    message: string;
  },
) {
  expect(payload.statusCode).toBe(409);
  expect(payload.error).toBe("Conflict");
  expect(payload.message).toBe(expected.message);
  expect(payload.blockingObjects.length).toBeGreaterThan(0);

  assertBlockingObject(
    payload.blockingObjects[0],
    expected.firstBlockingObject ?? {},
  );
}
