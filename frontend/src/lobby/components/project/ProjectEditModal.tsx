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
  LobbyProject,
  UpdateProjectRequest,
} from "../../contracts/lobby.contracts.js";
import {
  PROJECT_DIALOG_MAX_WIDTH,
  PROJECT_FORM_DIALOG_TITLE_EDIT,
  PROJECT_FORM_GAP,
  PROJECT_FORM_SUBMIT_LABEL_EDIT,
  PROJECT_UPDATE_ERROR_MESSAGE,
} from "./project-modal.constants.js";
import { ProjectFormFields } from "./ProjectFormFields.js";

interface ProjectEditModalProps {
  isBusy: boolean;
  isOpen: boolean;
  onClose(): void;
  onUpdate(projectId: number, payload: UpdateProjectRequest): Promise<LobbyProject>;
  project: LobbyProject | null;
}

interface ProjectFormState {
  description: string;
  journal: string;
  name: string;
}

function createFormState(project: LobbyProject | null): ProjectFormState {
  return {
    description: project?.description ?? "",
    journal: project?.journal ?? "",
    name: project?.name ?? "",
  };
}

function normalizeUpdatePayload(formState: ProjectFormState): UpdateProjectRequest {
  return {
    description: formState.description.trim() === "" ? null : formState.description,
    journal: formState.journal.trim() === "" ? null : formState.journal,
    name: formState.name,
  };
}

function buildUpdateFailureMessage(error: unknown): string {
  if (isApiError(error) && error.kind === "http" && error.responseBody) {
    return error.responseBody;
  }

  return PROJECT_UPDATE_ERROR_MESSAGE;
}

export function ProjectEditModal(props: ProjectEditModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState<ProjectFormState>(
    createFormState(props.project),
  );
  const nameInputReference = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!props.isOpen) {
      return;
    }

    setFormState(createFormState(props.project));
    setErrorMessage(null);

    const timeoutId = window.setTimeout(() => {
      nameInputReference.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [props.isOpen, props.project]);

  function closeDialog(): void {
    setErrorMessage(null);
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

  async function submitUpdate(): Promise<void> {
    if (!props.project) {
      return;
    }

    try {
      await props.onUpdate(props.project.id, normalizeUpdatePayload(formState));
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
      maxWidth={PROJECT_DIALOG_MAX_WIDTH}
      onClose={closeDialog}
      open={props.isOpen}
    >
      <DialogTitle>{PROJECT_FORM_DIALOG_TITLE_EDIT}</DialogTitle>
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
          <Button disabled={props.isBusy || !props.project} type="submit" variant="contained">
            {PROJECT_FORM_SUBMIT_LABEL_EDIT}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
