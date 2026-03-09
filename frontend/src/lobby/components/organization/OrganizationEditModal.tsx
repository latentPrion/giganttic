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
  LobbyOrganization,
  UpdateOrganizationRequest,
} from "../../contracts/lobby.contracts.js";
import {
  ORGANIZATION_DIALOG_MAX_WIDTH,
  ORGANIZATION_FORM_DIALOG_TITLE_EDIT,
  ORGANIZATION_FORM_GAP,
  ORGANIZATION_FORM_SUBMIT_LABEL_EDIT,
  ORGANIZATION_UPDATE_ERROR_MESSAGE,
} from "./organization-modal.constants.js";
import {
  createOrganizationFormState,
  normalizeOrganizationUpdatePayload,
} from "./organization-modal.utils.js";

interface OrganizationEditModalProps {
  isBusy: boolean;
  isOpen: boolean;
  onClose(): void;
  onUpdate(
    organizationId: number,
    payload: UpdateOrganizationRequest,
  ): Promise<LobbyOrganization>;
  organization: LobbyOrganization | null;
}

function buildUpdateFailureMessage(error: unknown): string {
  if (isApiError(error) && error.kind === "http" && error.responseBody) {
    return error.responseBody;
  }

  return ORGANIZATION_UPDATE_ERROR_MESSAGE;
}

export function OrganizationEditModal(props: OrganizationEditModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState(createOrganizationFormState(props.organization));
  const nameInputReference = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!props.isOpen) {
      return;
    }

    setFormState(createOrganizationFormState(props.organization));
    setErrorMessage(null);

    const timeoutId = window.setTimeout(() => {
      nameInputReference.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [props.isOpen, props.organization]);

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
    if (!props.organization) {
      return;
    }

    try {
      await props.onUpdate(
        props.organization.id,
        normalizeOrganizationUpdatePayload(formState),
      );
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
      maxWidth={ORGANIZATION_DIALOG_MAX_WIDTH}
      onClose={closeDialog}
      open={props.isOpen}
    >
      <DialogTitle>{ORGANIZATION_FORM_DIALOG_TITLE_EDIT}</DialogTitle>
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
          <Button
            disabled={props.isBusy || !props.organization}
            type="submit"
            variant="contained"
          >
            {ORGANIZATION_FORM_SUBMIT_LABEL_EDIT}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
