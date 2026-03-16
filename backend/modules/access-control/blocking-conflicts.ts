import { ConflictException } from "@nestjs/common";

export const BLOCKING_OBJECT_KIND_PROJECT = "project";
export const BLOCKING_OBJECT_KIND_TEAM = "team";
export const BLOCKING_OBJECT_KIND_ORGANIZATION = "organization";

export const BLOCKING_OBJECT_REASON_LAST_OWNER = "last_owner";
export const BLOCKING_OBJECT_REASON_LAST_EFFECTIVE_PROJECT_MANAGER =
  "last_effective_project_manager";
export const BLOCKING_OBJECT_REASON_LAST_EFFECTIVE_TEAM_MANAGER =
  "last_effective_team_manager";
export const BLOCKING_OBJECT_REASON_LAST_EFFECTIVE_ORGANIZATION_MANAGER =
  "last_effective_organization_manager";

export type BlockingObjectKind =
  | typeof BLOCKING_OBJECT_KIND_PROJECT
  | typeof BLOCKING_OBJECT_KIND_TEAM
  | typeof BLOCKING_OBJECT_KIND_ORGANIZATION;

export type BlockingObjectReason =
  | typeof BLOCKING_OBJECT_REASON_LAST_OWNER
  | typeof BLOCKING_OBJECT_REASON_LAST_EFFECTIVE_PROJECT_MANAGER
  | typeof BLOCKING_OBJECT_REASON_LAST_EFFECTIVE_TEAM_MANAGER
  | typeof BLOCKING_OBJECT_REASON_LAST_EFFECTIVE_ORGANIZATION_MANAGER;

export type BlockingObject = {
  id: number;
  kind: BlockingObjectKind;
  reason: BlockingObjectReason;
};

type BlockingConflictPayload = {
  blockingObjects: BlockingObject[];
  error: "Conflict";
  message: string;
  statusCode: 409;
};

function createBlockingConflictPayload(
  message: string,
  blockingObjects: ReadonlyArray<BlockingObject>,
): BlockingConflictPayload {
  return {
    blockingObjects: [...blockingObjects],
    error: "Conflict",
    message,
    statusCode: 409,
  };
}

export function createBlockingConflictException(
  message: string,
  blockingObjects: ReadonlyArray<BlockingObject>,
): ConflictException {
  return new ConflictException(
    createBlockingConflictPayload(message, blockingObjects),
  );
}
