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
  CreateOrganizationRequest,
  LobbyOrganization,
} from "../../contracts/lobby.contracts.js";
import {
  ORGANIZATION_CREATE_ERROR_MESSAGE,
  ORGANIZATION_DIALOG_MAX_WIDTH,
  ORGANIZATION_FORM_DIALOG_TITLE_CREATE,
  ORGANIZATION_FORM_GAP,
  ORGANIZATION_FORM_SUBMIT_LABEL_CREATE,
} from "./organization-modal.constants.js";
import { normalizeOrganizationCreatePayload } from "./organization-modal.utils.js";

interface OrganizationCreateModalProps {
  isBusy: boolean;
  isOpen: boolean;
  onClose(): void;
  onCreate(payload: CreateOrganizationRequest): Promise<LobbyOrganization>;
}

const DEFAULT_FORM_STATE = {
  description: "",
  name: "",
};

function buildCreateFailureMessage(error: unknown): string {
  if (isApiError(error) && error.kind === "http" && error.responseBody) {
    return error.responseBody;
  }

  return ORGANIZATION_CREATE_ERROR_MESSAGE;
}

export function OrganizationCreateModal(props: OrganizationCreateModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState(DEFAULT_FORM_STATE);
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

  function updateField(key: "description" | "name", value: string): void {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function submitCreate(): Promise<void> {
    try {
      await props.onCreate(normalizeOrganizationCreatePayload(formState));
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
      maxWidth={ORGANIZATION_DIALOG_MAX_WIDTH}
      onClose={closeDialog}
      open={props.isOpen}
    >
      <DialogTitle>{ORGANIZATION_FORM_DIALOG_TITLE_CREATE}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent
          sx={{ display: "grid", gap: ORGANIZATION_FORM_GAP, paddingTop: ORGANIZATION_FORM_GAP }}
        >
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
          <Button disabled={props.isBusy} type="submit" variant="contained">
            {ORGANIZATION_FORM_SUBMIT_LABEL_CREATE}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
