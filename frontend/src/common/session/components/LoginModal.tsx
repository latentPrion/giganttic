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

import { isApiError } from "../../api/api-error.js";
import type { LoginRequest } from "../contracts/auth.contracts.js";
import { AuthStatusDialog } from "./AuthStatusDialog.js";

interface LoginModalProps {
  isBusy: boolean;
  isOpen: boolean;
  onClose(): void;
  onLogin(payload: LoginRequest): Promise<void>;
}

interface FeedbackState {
  isOpen: boolean;
  message: string;
}

interface LoginFormState {
  password: string;
  username: string;
}

const DEFAULT_FORM_STATE: LoginFormState = {
  password: "",
  username: "",
};
const DEFAULT_FEEDBACK_STATE: FeedbackState = {
  isOpen: false,
  message: "",
};
const DIALOG_ACTIONS_PADDING = 3;
const DIALOG_ACTIONS_TOP_PADDING = 1;
const DIALOG_MAX_WIDTH = "xs";
const DIALOG_TITLE = "Login";
const FORM_GAP = 2;
const LOGIN_FAILURE_TITLE = "Login Failed";
const DEFAULT_LOGIN_FAILURE_MESSAGE = "Login failed.";
const SUBMIT_BUTTON_LABEL = "Log In";

function toLoginPayload(formState: LoginFormState): LoginRequest {
  return {
    password: formState.password,
    username: formState.username,
  };
}

function buildLoginFailureMessage(error: unknown): string {
  if (!isApiError(error)) {
    return DEFAULT_LOGIN_FAILURE_MESSAGE;
  }

  if (error.kind === "http" && error.responseBody) {
    return error.responseBody;
  }

  return DEFAULT_LOGIN_FAILURE_MESSAGE;
}

export function LoginModal(props: LoginModalProps) {
  const [formState, setFormState] = useState<LoginFormState>(DEFAULT_FORM_STATE);
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
  }

  function updateField<K extends keyof LoginFormState>(
    key: K,
    value: LoginFormState[K],
  ): void {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function submitLogin(): Promise<void> {
    try {
      await props.onLogin(toLoginPayload(formState));
      closeDialog();
    } catch (error) {
      closeDialog();
      setFeedbackState({
        isOpen: true,
        message: buildLoginFailureMessage(error),
      });
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submitLogin();
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
              {SUBMIT_BUTTON_LABEL}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <AuthStatusDialog
        isOpen={feedbackState.isOpen}
        message={feedbackState.message}
        onClose={closeFeedbackDialog}
        title={LOGIN_FAILURE_TITLE}
      />
    </>
  );
}
