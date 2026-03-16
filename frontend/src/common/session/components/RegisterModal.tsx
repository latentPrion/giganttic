import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";

import { getApiErrorMessage, isApiError } from "../../api/api-error.js";
import type { RegisterRequest } from "../contracts/auth.contracts.js";
import { AuthStatusDialog } from "./AuthStatusDialog.js";

interface RegisterModalProps {
  isBusy: boolean;
  isOpen: boolean;
  onClose(): void;
  onRegister(payload: RegisterRequest): Promise<void>;
  successReturnFocusRef?: React.RefObject<HTMLElement | null>;
}

interface FeedbackState {
  isOpen: boolean;
  message: string;
  title: string;
}

interface RegisterFormState {
  email: string;
  password: string;
  username: string;
}

const DEFAULT_FORM_STATE: RegisterFormState = {
  email: "",
  password: "",
  username: "",
};
const DEFAULT_FEEDBACK_STATE: FeedbackState = {
  isOpen: false,
  message: "",
  title: "",
};
const CREATE_ACCOUNT_LABEL = "Create Account";
const DIALOG_ACTIONS_PADDING = 3;
const DIALOG_ACTIONS_TOP_PADDING = 1;
const DIALOG_MAX_WIDTH = "sm";
const DIALOG_TITLE = "Register";
const FORM_GAP = 2;
const REGISTRATION_FAILURE_TITLE = "Registration Failed";
const DEFAULT_REGISTRATION_FAILURE_MESSAGE = "Registration failed.";
const REGISTRATION_SUCCESS_TITLE = "Registration Succeeded";
const REGISTRATION_SUCCESS_MESSAGE =
  "Registration succeeded. You can now log in.";

function toRegisterPayload(formState: RegisterFormState): RegisterRequest {
  return {
    email: formState.email,
    password: formState.password,
    username: formState.username,
  };
}

function buildRegistrationFailureMessage(error: unknown): string {
  if (!isApiError(error)) {
    return DEFAULT_REGISTRATION_FAILURE_MESSAGE;
  }

  return getApiErrorMessage(error, DEFAULT_REGISTRATION_FAILURE_MESSAGE);
}

export function RegisterModal(props: RegisterModalProps) {
  const [formState, setFormState] = useState<RegisterFormState>(DEFAULT_FORM_STATE);
  const [feedbackState, setFeedbackState] = useState<FeedbackState>(DEFAULT_FEEDBACK_STATE);
  const usernameInputReference = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!props.isOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      usernameInputReference.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [props.isOpen]);

  function closeDialog(): void {
    setFormState(DEFAULT_FORM_STATE);
    props.onClose();
  }

  function closeFeedbackDialog(): void {
    setFeedbackState(DEFAULT_FEEDBACK_STATE);
    window.setTimeout(() => {
      props.successReturnFocusRef?.current?.focus();
    }, 0);
  }

  function updateField<K extends keyof RegisterFormState>(
    key: K,
    value: RegisterFormState[K],
  ): void {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function submitRegistration(): Promise<void> {
    try {
      await props.onRegister(toRegisterPayload(formState));
      closeDialog();
      setFeedbackState({
        isOpen: true,
        message: REGISTRATION_SUCCESS_MESSAGE,
        title: REGISTRATION_SUCCESS_TITLE,
      });
    } catch (error) {
      closeDialog();
      setFeedbackState({
        isOpen: true,
        message: buildRegistrationFailureMessage(error),
        title: REGISTRATION_FAILURE_TITLE,
      });
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submitRegistration();
  }

  return (
    <>
      <Dialog
        fullWidth
        maxWidth={DIALOG_MAX_WIDTH}
        onClose={closeDialog}
        open={props.isOpen}
      >
        <DialogTitle>{DIALOG_TITLE}</DialogTitle>
        <Box component="form" onSubmit={handleSubmit}>
          <DialogContent sx={{ display: "grid", gap: FORM_GAP, paddingTop: FORM_GAP }}>
            <TextField
              inputRef={usernameInputReference}
              label="Username"
              onChange={(event) => updateField("username", event.target.value)}
              value={formState.username}
            />
            <TextField
              label="Email"
              onChange={(event) => updateField("email", event.target.value)}
              type="email"
              value={formState.email}
            />
            <TextField
              label="Password"
              onChange={(event) => updateField("password", event.target.value)}
              type="password"
              value={formState.password}
            />
          </DialogContent>
          <DialogActions
            sx={{
              padding: DIALOG_ACTIONS_PADDING,
              paddingTop: DIALOG_ACTIONS_TOP_PADDING,
            }}
          >
            <Button onClick={closeDialog} type="button">
              Cancel
            </Button>
            <Button disabled={props.isBusy} type="submit" variant="contained">
              {CREATE_ACCOUNT_LABEL}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <AuthStatusDialog
        isOpen={feedbackState.isOpen}
        message={feedbackState.message}
        onClose={closeFeedbackDialog}
        title={feedbackState.title}
      />
    </>
  );
}
