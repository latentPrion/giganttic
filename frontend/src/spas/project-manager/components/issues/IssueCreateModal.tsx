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
  CreateIssueRequest,
  Issue,
} from "../../contracts/issue.contracts.js";
import { IssueFormFields } from "./IssueFormFields.js";
import {
  createIssueFormState,
  normalizeCreateIssuePayload,
  type IssueFormState,
} from "./issue-form.types.js";
import {
  ISSUE_CREATE_ERROR_MESSAGE,
  ISSUE_DIALOG_MAX_WIDTH,
  ISSUE_FORM_DIALOG_TITLE_CREATE,
  ISSUE_FORM_GAP,
  ISSUE_FORM_SUBMIT_LABEL_CREATE,
} from "./issue-modal.constants.js";

interface IssueCreateModalProps {
  isBusy: boolean;
  isOpen: boolean;
  onClose(): void;
  onCreate(payload: CreateIssueRequest): Promise<Issue>;
}

function buildCreateFailureMessage(error: unknown): string {
  if (isApiError(error) && error.kind === "http" && error.responseBody) {
    return error.responseBody;
  }

  return ISSUE_CREATE_ERROR_MESSAGE;
}

export function IssueCreateModal(props: IssueCreateModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState<IssueFormState>(createIssueFormState(null));
  const nameInputReference = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!props.isOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      nameInputReference.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [props.isOpen]);

  function closeDialog(): void {
    setErrorMessage(null);
    setFormState(createIssueFormState(null));
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

  async function submitCreate(): Promise<void> {
    try {
      await props.onCreate(normalizeCreateIssuePayload(formState));
      closeDialog();
    } catch (error) {
      setErrorMessage(buildCreateFailureMessage(error));
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submitCreate();
  }

  return (
    <Dialog
      fullWidth
      maxWidth={ISSUE_DIALOG_MAX_WIDTH}
      onClose={closeDialog}
      open={props.isOpen}
    >
      <DialogTitle>{ISSUE_FORM_DIALOG_TITLE_CREATE}</DialogTitle>
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
          <Button disabled={props.isBusy} type="submit" variant="contained">
            {ISSUE_FORM_SUBMIT_LABEL_CREATE}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
