import React from "react";
import {
  MenuItem,
  TextField,
} from "@mui/material";
import type {
  ClosedReason,
  IssueStatus,
} from "../../contracts/issue.contracts.js";

interface IssueFormState {
  closedReason: ClosedReason | "";
  closedReasonDescription: string;
  description: string;
  journal: string;
  name: string;
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
  "ISSUE_STATUS_BLOCKED",
  "ISSUE_STATUS_CLOSED",
];
const CLOSED_REASON_OPTIONS: ClosedReason[] = [
  "ISSUE_CLOSED_REASON_RESOLVED",
  "ISSUE_CLOSED_REASON_WONTFIX",
  "ISSUE_CLOSED_REASON_CANTFIX",
];
const CLOSED_STATUS = "ISSUE_STATUS_CLOSED";

function createIssueStatusLabel(status: IssueStatus): string {
  return status.replace("ISSUE_STATUS_", "").toLowerCase();
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
        inputRef={props.nameInputRef}
        label="Name"
        onChange={(event) => props.onFieldChange("name", event.target.value)}
        value={props.formState.name}
      />
      <TextField
        label="Description"
        minRows={3}
        multiline
        onChange={(event) => props.onFieldChange("description", event.target.value)}
        value={props.formState.description}
      />
      <TextField
        label="Journal"
        minRows={4}
        multiline
        onChange={(event) => props.onFieldChange("journal", event.target.value)}
        value={props.formState.journal}
      />
      <TextField
        label="Status"
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
        label="Progress Percentage"
        onChange={(event) => props.onFieldChange("progressPercentage", event.target.value)}
        type="number"
        value={props.formState.progressPercentage}
      />
      <TextField
        disabled={closedFieldsDisabled}
        label="Closed Reason"
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
        label="Closed Reason Description"
        minRows={2}
        multiline
        onChange={(event) => props.onFieldChange("closedReasonDescription", event.target.value)}
        value={props.formState.closedReasonDescription}
      />
    </>
  );
}
