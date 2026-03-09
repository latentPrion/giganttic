import type {
  ClosedReason,
  CreateIssueRequest,
  Issue,
  IssueStatus,
  UpdateIssueRequest,
} from "../../contracts/issue.contracts.js";
import { ISSUE_DEFAULT_PROGRESS } from "./issue-modal.constants.js";

export interface IssueFormState {
  closedReason: ClosedReason | "";
  closedReasonDescription: string;
  description: string;
  journal: string;
  name: string;
  progressPercentage: string;
  status: IssueStatus;
}

const DEFAULT_ISSUE_STATUS: IssueStatus = "ISSUE_STATUS_OPEN";

export function createIssueFormState(issue: Issue | null): IssueFormState {
  return {
    closedReason: issue?.closedReason ?? "",
    closedReasonDescription: issue?.closedReasonDescription ?? "",
    description: issue?.description ?? "",
    journal: issue?.journal ?? "",
    name: issue?.name ?? "",
    progressPercentage: `${issue?.progressPercentage ?? ISSUE_DEFAULT_PROGRESS}`,
    status: issue?.status ?? DEFAULT_ISSUE_STATUS,
  };
}

function normalizeTextValue(value: string): string | null {
  return value.trim() === "" ? null : value;
}

function normalizeClosedReason(
  value: IssueFormState["closedReason"],
): ClosedReason | null | undefined {
  return value === "" ? null : value;
}

function normalizeProgressPercentage(value: string): number | undefined {
  if (value.trim() === "") {
    return undefined;
  }

  return Number(value);
}

export function normalizeCreateIssuePayload(
  formState: IssueFormState,
): CreateIssueRequest {
  return {
    closedReason: normalizeClosedReason(formState.closedReason),
    closedReasonDescription: normalizeTextValue(formState.closedReasonDescription),
    description: normalizeTextValue(formState.description),
    journal: normalizeTextValue(formState.journal),
    name: formState.name,
    progressPercentage: normalizeProgressPercentage(formState.progressPercentage),
    status: formState.status,
  };
}

export function normalizeUpdateIssuePayload(
  formState: IssueFormState,
): UpdateIssueRequest {
  return {
    closedReason: normalizeClosedReason(formState.closedReason),
    closedReasonDescription: normalizeTextValue(formState.closedReasonDescription),
    description: normalizeTextValue(formState.description),
    journal: normalizeTextValue(formState.journal),
    name: formState.name,
    progressPercentage: normalizeProgressPercentage(formState.progressPercentage),
    status: formState.status,
  };
}
