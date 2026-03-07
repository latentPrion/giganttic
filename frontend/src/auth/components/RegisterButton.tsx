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

import type { RegisterRequest } from "../contracts/auth.contracts.js";
import { isApiError } from "../api/api-error.js";
import { AuthStatusDialog } from "./AuthStatusDialog.js";

interface RegisterButtonProps {
  isBusy: boolean;
  onRegister(payload: RegisterRequest): Promise<void>;
  successReturnFocusRef?: React.RefObject<HTMLButtonElement | null>;
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
const DIALOG_TITLE = "Register";
const REGISTER_BUTTON_LABEL = "Register";
const SUBMIT_BUTTON_LABEL = "Create Account";
const DIALOG_MAX_WIDTH = "sm";
const FORM_GAP = 2;
const DIALOG_ACTIONS_PADDING = 3;
const DIALOG_ACTIONS_TOP_PADDING = 1;
const REGISTRATION_SUCCESS_TITLE = "Registration Succeeded";
const REGISTRATION_SUCCESS_MESSAGE =
  "Registration succeeded. You can now log in.";
const REGISTRATION_FAILURE_TITLE = "Registration Failed";
const DEFAULT_REGISTRATION_FAILURE_MESSAGE = "Registration failed.";

interface FeedbackState {
  isOpen: boolean;
  message: string;
  title: string;
}

const DEFAULT_FEEDBACK_STATE: FeedbackState = {
  isOpen: false,
  message: "",
  title: "",
};

function toRegisterPayload(formState: RegisterFormState): RegisterRequest {
  return {
    email: formState.email,
    password: formState.password,
    username: formState.username,
  };
}

export function RegisterButton({
  isBusy,
  onRegister,
  successReturnFocusRef,
}: RegisterButtonProps) {
  const [formState, setFormState] = useState<RegisterFormState>(DEFAULT_FORM_STATE);
  const [feedbackState, setFeedbackState] = useState<FeedbackState>(DEFAULT_FEEDBACK_STATE);
  const [isOpen, setIsOpen] = useState(false);
  const usernameInputReference = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      usernameInputReference.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isOpen]);

  function openDialog(): void {
    setIsOpen(true);
  }

  function closeDialog(): void {
    setFormState(DEFAULT_FORM_STATE);
    setIsOpen(false);
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
      await onRegister(toRegisterPayload(formState));
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

  function closeFeedbackDialog(): void {
    setFeedbackState(DEFAULT_FEEDBACK_STATE);
    window.setTimeout(() => {
      successReturnFocusRef?.current?.focus();
    }, 0);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submitRegistration();
  }

  function buildRegistrationFailureMessage(error: unknown): string {
    if (!isApiError(error)) {
      return DEFAULT_REGISTRATION_FAILURE_MESSAGE;
    }

    if (error.kind === "http" && error.responseBody) {
      return error.responseBody;
    }

    return DEFAULT_REGISTRATION_FAILURE_MESSAGE;
  }

  return (
    <>
      <Button onClick={openDialog} variant="contained">
        {REGISTER_BUTTON_LABEL}
      </Button>
      <Dialog
        fullWidth
        maxWidth={DIALOG_MAX_WIDTH}
        onClose={closeDialog}
        open={isOpen}
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
            <Button disabled={isBusy} type="submit" variant="contained">
              {SUBMIT_BUTTON_LABEL}
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
