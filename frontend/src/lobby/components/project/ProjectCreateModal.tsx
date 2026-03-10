import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";

import { isApiError } from "../../../common/api/api-error.js";
import type {
  CreateProjectRequest,
  LobbyProject,
} from "../../contracts/lobby.contracts.js";
import {
  PROJECT_CREATE_ERROR_MESSAGE,
  PROJECT_DIALOG_MAX_WIDTH,
  PROJECT_FORM_DIALOG_TITLE_CREATE,
  PROJECT_FORM_GAP,
  PROJECT_FORM_SUBMIT_LABEL_CREATE,
} from "./project-modal.constants.js";
import { ProjectFormFields } from "./ProjectFormFields.js";

interface ProjectCreateModalProps {
  isBusy: boolean;
  isOpen: boolean;
  onClose(): void;
  onCreate(payload: CreateProjectRequest): Promise<LobbyProject>;
}

interface ProjectFormState {
  description: string;
  journal: string;
  name: string;
}

const DEFAULT_FORM_STATE: ProjectFormState = {
  description: "",
  journal: "",
  name: "",
};

function normalizeCreatePayload(formState: ProjectFormState): CreateProjectRequest {
  return {
    description: formState.description.trim() === "" ? null : formState.description,
    journal: formState.journal.trim() === "" ? null : formState.journal,
    name: formState.name,
  };
}

function buildCreateFailureMessage(error: unknown): string {
  if (isApiError(error) && error.kind === "http" && error.responseBody) {
    return error.responseBody;
  }

  return PROJECT_CREATE_ERROR_MESSAGE;
}

export function ProjectCreateModal(props: ProjectCreateModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState<ProjectFormState>(DEFAULT_FORM_STATE);
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
    setFormState(DEFAULT_FORM_STATE);
    props.onClose();
  }

  function updateField<K extends keyof ProjectFormState>(
    key: K,
    value: ProjectFormState[K],
  ): void {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function submitCreate(): Promise<void> {
    try {
      await props.onCreate(normalizeCreatePayload(formState));
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
      maxWidth={PROJECT_DIALOG_MAX_WIDTH}
      onClose={closeDialog}
      open={props.isOpen}
    >
      <DialogTitle>{PROJECT_FORM_DIALOG_TITLE_CREATE}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ display: "grid", gap: PROJECT_FORM_GAP, paddingTop: PROJECT_FORM_GAP }}>
          <ProjectFormFields
            nameInputRef={nameInputReference}
            formState={formState}
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
            {PROJECT_FORM_SUBMIT_LABEL_CREATE}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
