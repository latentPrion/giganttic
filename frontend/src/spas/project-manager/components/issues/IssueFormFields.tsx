import React from "react";
import {
  MenuItem,
  TextField,
} from "@mui/material";
import type {
  ClosedReason,
  IssueStatus,
} from "../../contracts/issue.contracts.js";
import type { IssuePriorityCode } from "../../lib/issue-priority.js";
import { createIssuePriorityOptions } from "../../lib/issue-priority.js";

interface IssueFormState {
  closedReason: ClosedReason | "";
  closedReasonDescription: string;
  description: string;
  journal: string;
  name: string;
  priority: string;
  progressPercentage: string;
  status: IssueStatus;
}

interface IssueFormFieldsProps {
  formState: IssueFormState;
  nameInputRef?: React.RefObject<HTMLInputElement | null>;
  onFieldChange<K extends keyof IssueFormState>(
    key: K,
    value: IssueFormState[K],
  ): void;
}

const ISSUE_STATUS_OPTIONS: IssueStatus[] = [
  "ISSUE_STATUS_OPEN",
  "ISSUE_STATUS_IN_PROGRESS",
  "ISSUE_STATUS_BLOCKED",
  "ISSUE_STATUS_CLOSED",
];
const CLOSED_REASON_OPTIONS: ClosedReason[] = [
  "ISSUE_CLOSED_REASON_RESOLVED",
  "ISSUE_CLOSED_REASON_WONTFIX",
  "ISSUE_CLOSED_REASON_CANTFIX",
];
const CLOSED_STATUS = "ISSUE_STATUS_CLOSED";
const ISSUE_PROGRESS_PERCENTAGE_MAXIMUM = 100;
const ISSUE_PROGRESS_PERCENTAGE_MINIMUM = 0;
const ISSUE_PRIORITY_OPTIONS = createIssuePriorityOptions();
const ISSUE_FIELD_NAME = "name";
const ISSUE_FIELD_DESCRIPTION = "description";
const ISSUE_FIELD_JOURNAL = "journal";
const ISSUE_FIELD_STATUS = "status";
const ISSUE_FIELD_PRIORITY = "priority";
const ISSUE_FIELD_PROGRESS_PERCENTAGE = "progressPercentage";
const ISSUE_FIELD_CLOSED_REASON = "closedReason";
const ISSUE_FIELD_CLOSED_REASON_DESCRIPTION = "closedReasonDescription";

function createIssueStatusLabel(status: IssueStatus): string {
  return status.replace("ISSUE_STATUS_", "").toLowerCase().replace("_", " ");
}

function createClosedReasonLabel(reason: ClosedReason): string {
  return reason.replace("ISSUE_CLOSED_REASON_", "").toLowerCase();
}

function isClosedStatus(status: IssueStatus): boolean {
  return status === CLOSED_STATUS;
}

export function IssueFormFields(props: IssueFormFieldsProps) {
  const closedFieldsDisabled = !isClosedStatus(props.formState.status);

  return (
    <>
      <TextField
        id="issue-name"
        inputRef={props.nameInputRef}
        label="Name"
        name={ISSUE_FIELD_NAME}
        onChange={(event) => props.onFieldChange("name", event.target.value)}
        value={props.formState.name}
      />
      <TextField
        id="issue-description"
        label="Description"
        minRows={3}
        multiline
        name={ISSUE_FIELD_DESCRIPTION}
        onChange={(event) => props.onFieldChange("description", event.target.value)}
        value={props.formState.description}
      />
      <TextField
        id="issue-journal"
        label="Journal"
        minRows={4}
        multiline
        name={ISSUE_FIELD_JOURNAL}
        onChange={(event) => props.onFieldChange("journal", event.target.value)}
        value={props.formState.journal}
      />
      <TextField
        id="issue-status"
        label="Status"
        name={ISSUE_FIELD_STATUS}
        onChange={(event) => props.onFieldChange("status", event.target.value as IssueStatus)}
        select
        value={props.formState.status}
      >
        {ISSUE_STATUS_OPTIONS.map((status) => (
          <MenuItem key={status} value={status}>
            {createIssueStatusLabel(status)}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        id="issue-priority"
        label="Priority"
        name={ISSUE_FIELD_PRIORITY}
        onChange={(event) => props.onFieldChange("priority", event.target.value)}
        select
        value={props.formState.priority}
      >
        {ISSUE_PRIORITY_OPTIONS.map((priority: { label: string; value: IssuePriorityCode }) => (
          <MenuItem key={priority.value} value={`${priority.value}`}>
            {priority.label}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        id="issue-progress-percentage"
        inputProps={{
          max: ISSUE_PROGRESS_PERCENTAGE_MAXIMUM,
          min: ISSUE_PROGRESS_PERCENTAGE_MINIMUM,
        }}
        label="Progress Percentage"
        name={ISSUE_FIELD_PROGRESS_PERCENTAGE}
        onChange={(event) => props.onFieldChange("progressPercentage", event.target.value)}
        type="number"
        value={props.formState.progressPercentage}
      />
      <TextField
        disabled={closedFieldsDisabled}
        id="issue-closed-reason"
        label="Closed Reason"
        name={ISSUE_FIELD_CLOSED_REASON}
        onChange={(event) => props.onFieldChange("closedReason", event.target.value as ClosedReason | "")}
        select
        value={props.formState.closedReason}
      >
        <MenuItem value="">None</MenuItem>
        {CLOSED_REASON_OPTIONS.map((reason) => (
          <MenuItem key={reason} value={reason}>
            {createClosedReasonLabel(reason)}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        disabled={closedFieldsDisabled}
        id="issue-closed-reason-description"
        label="Closed Reason Description"
        minRows={2}
        multiline
        name={ISSUE_FIELD_CLOSED_REASON_DESCRIPTION}
        onChange={(event) => props.onFieldChange("closedReasonDescription", event.target.value)}
        value={props.formState.closedReasonDescription}
      />
    </>
  );
}
