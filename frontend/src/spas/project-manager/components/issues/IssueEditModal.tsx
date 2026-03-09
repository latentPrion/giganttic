import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { isApiError } from "../../../../common/api/api-error.js";
import type {
  Issue,
  UpdateIssueRequest,
} from "../../contracts/issue.contracts.js";
import { IssueFormFields } from "./IssueFormFields.js";
import {
  createIssueFormState,
  normalizeUpdateIssuePayload,
  type IssueFormState,
} from "./issue-form.types.js";
import {
  ISSUE_DIALOG_MAX_WIDTH,
  ISSUE_FORM_DIALOG_TITLE_EDIT,
  ISSUE_FORM_GAP,
  ISSUE_FORM_SUBMIT_LABEL_EDIT,
  ISSUE_UPDATE_ERROR_MESSAGE,
} from "./issue-modal.constants.js";

interface IssueEditModalProps {
  isBusy: boolean;
  isOpen: boolean;
  issue: Issue | null;
  onClose(): void;
  onUpdate(issueId: number, payload: UpdateIssueRequest): Promise<Issue>;
}

function buildUpdateFailureMessage(error: unknown): string {
  if (isApiError(error) && error.kind === "http" && error.responseBody) {
    return error.responseBody;
  }

  return ISSUE_UPDATE_ERROR_MESSAGE;
}

export function IssueEditModal(props: IssueEditModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState<IssueFormState>(createIssueFormState(props.issue));
  const nameInputReference = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!props.isOpen) {
      return;
    }

    setErrorMessage(null);
    setFormState(createIssueFormState(props.issue));

    const timeoutId = window.setTimeout(() => {
      nameInputReference.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [props.isOpen, props.issue]);

  function closeDialog(): void {
    setErrorMessage(null);
    props.onClose();
  }

  function updateField<K extends keyof IssueFormState>(
    key: K,
    value: IssueFormState[K],
  ): void {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function submitUpdate(): Promise<void> {
    if (!props.issue) {
      return;
    }

    try {
      await props.onUpdate(props.issue.id, normalizeUpdateIssuePayload(formState));
      closeDialog();
    } catch (error) {
      setErrorMessage(buildUpdateFailureMessage(error));
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submitUpdate();
  }

  return (
    <Dialog
      fullWidth
      maxWidth={ISSUE_DIALOG_MAX_WIDTH}
      onClose={closeDialog}
      open={props.isOpen}
    >
      <DialogTitle>{ISSUE_FORM_DIALOG_TITLE_EDIT}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ display: "grid", gap: ISSUE_FORM_GAP, paddingTop: ISSUE_FORM_GAP }}>
          <IssueFormFields
            formState={formState}
            nameInputRef={nameInputReference}
            onFieldChange={updateField}
          />
          {errorMessage ? (
            <Box color="error.main" component="p" sx={{ margin: 0 }}>
              {errorMessage}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ padding: 3, paddingTop: 1 }}>
          <Button onClick={closeDialog} type="button">
            Cancel
          </Button>
          <Button disabled={props.isBusy || !props.issue} type="submit" variant="contained">
            {ISSUE_FORM_SUBMIT_LABEL_EDIT}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
