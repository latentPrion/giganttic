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
import { NameDescriptionFormFields } from "../shared/NameDescriptionFormFields.js";
import type {
  LobbyTeam,
  UpdateTeamRequest,
} from "../../contracts/lobby.contracts.js";
import {
  TEAM_DIALOG_MAX_WIDTH,
  TEAM_FORM_DIALOG_TITLE_EDIT,
  TEAM_FORM_GAP,
  TEAM_FORM_SUBMIT_LABEL_EDIT,
  TEAM_UPDATE_ERROR_MESSAGE,
} from "./team-modal.constants.js";
import {
  createTeamFormState,
  normalizeTeamUpdatePayload,
} from "./team-modal.utils.js";

interface TeamEditModalProps {
  isBusy: boolean;
  isOpen: boolean;
  onClose(): void;
  onUpdate(teamId: number, payload: UpdateTeamRequest): Promise<LobbyTeam>;
  team: LobbyTeam | null;
}

function buildUpdateFailureMessage(error: unknown): string {
  if (isApiError(error) && error.kind === "http" && error.responseBody) {
    return error.responseBody;
  }

  return TEAM_UPDATE_ERROR_MESSAGE;
}

export function TeamEditModal(props: TeamEditModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState(createTeamFormState(props.team));
  const nameInputReference = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!props.isOpen) {
      return;
    }

    setFormState(createTeamFormState(props.team));
    setErrorMessage(null);

    const timeoutId = window.setTimeout(() => {
      nameInputReference.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [props.isOpen, props.team]);

  function closeDialog(): void {
    setErrorMessage(null);
    props.onClose();
  }

  function updateField(key: "description" | "name", value: string): void {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function submitUpdate(): Promise<void> {
    if (!props.team) {
      return;
    }

    try {
      await props.onUpdate(props.team.id, normalizeTeamUpdatePayload(formState));
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
      maxWidth={TEAM_DIALOG_MAX_WIDTH}
      onClose={closeDialog}
      open={props.isOpen}
    >
      <DialogTitle>{TEAM_FORM_DIALOG_TITLE_EDIT}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ display: "grid", gap: TEAM_FORM_GAP, paddingTop: TEAM_FORM_GAP }}>
          <NameDescriptionFormFields
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
          <Button disabled={props.isBusy || !props.team} type="submit" variant="contained">
            {TEAM_FORM_SUBMIT_LABEL_EDIT}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
