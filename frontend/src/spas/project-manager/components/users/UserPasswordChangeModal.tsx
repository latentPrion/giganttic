import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
} from "@mui/material";

import { isApiError } from "../../../../common/api/api-error.js";
import type { ChangeUserPasswordRequest } from "../../../../lobby/contracts/lobby.contracts.js";

interface UserPasswordChangeModalProps {
  isBusy: boolean;
  isOpen: boolean;
  onClose(): void;
  onSubmit(payload: ChangeUserPasswordRequest): Promise<void>;
  requireCurrentPassword: boolean;
}

const CHANGE_PASSWORD_DIALOG_TITLE = "Change Password";
const CHANGE_PASSWORD_ERROR_MESSAGE = "Unable to change that password.";
const CHANGE_PASSWORD_SUBMIT_LABEL = "Save Password";
const DEFAULT_FORM_STATE = {
  currentPassword: "",
  newPassword: "",
  revokeSessions: false,
};

function buildFailureMessage(error: unknown): string {
  if (isApiError(error) && error.kind === "http" && error.responseBody) {
    return error.responseBody;
  }

  return CHANGE_PASSWORD_ERROR_MESSAGE;
}

export function UserPasswordChangeModal(props: UserPasswordChangeModalProps) {
  const [currentPassword, setCurrentPassword] = useState(DEFAULT_FORM_STATE.currentPassword);
  const [newPassword, setNewPassword] = useState(DEFAULT_FORM_STATE.newPassword);
  const [revokeSessions, setRevokeSessions] = useState(DEFAULT_FORM_STATE.revokeSessions);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const firstInputReference = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!props.isOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      firstInputReference.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [props.isOpen]);

  function resetForm(): void {
    setCurrentPassword(DEFAULT_FORM_STATE.currentPassword);
    setNewPassword(DEFAULT_FORM_STATE.newPassword);
    setRevokeSessions(DEFAULT_FORM_STATE.revokeSessions);
    setErrorMessage(null);
  }

  function handleClose(): void {
    resetForm();
    props.onClose();
  }

  async function submitChange(): Promise<void> {
    try {
      await props.onSubmit({
        currentPassword: props.requireCurrentPassword ? currentPassword : undefined,
        newPassword,
        revokeSessions,
      });
      handleClose();
    } catch (error) {
      setErrorMessage(buildFailureMessage(error));
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submitChange();
  }

  return (
    <Dialog fullWidth maxWidth="sm" onClose={handleClose} open={props.isOpen}>
      <DialogTitle>{CHANGE_PASSWORD_DIALOG_TITLE}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ display: "grid", gap: 2, paddingTop: 2 }}>
          <Stack spacing={2}>
            {props.requireCurrentPassword ? (
              <TextField
                inputRef={firstInputReference}
                label="Current Password"
                onChange={(event) => setCurrentPassword(event.target.value)}
                type="password"
                value={currentPassword}
              />
            ) : null}
            <TextField
              inputRef={props.requireCurrentPassword ? undefined : firstInputReference}
              label="New Password"
              onChange={(event) => setNewPassword(event.target.value)}
              type="password"
              value={newPassword}
            />
            <FormControlLabel
              control={(
                <Switch
                  checked={revokeSessions}
                  onChange={(event) => setRevokeSessions(event.target.checked)}
                />
              )}
              label="Revoke sessions"
            />
            {errorMessage ? (
              <Box color="error.main" component="p" sx={{ margin: 0 }}>
                {errorMessage}
              </Box>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ padding: 3, paddingTop: 1 }}>
          <Button onClick={handleClose} type="button">
            Cancel
          </Button>
          <Button disabled={props.isBusy} type="submit" variant="contained">
            {CHANGE_PASSWORD_SUBMIT_LABEL}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
