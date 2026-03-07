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

import type { LoginRequest } from "../contracts/auth.contracts.js";
import { isApiError } from "../api/api-error.js";
import { AuthStatusDialog } from "./AuthStatusDialog.js";

interface LoginButtonProps {
  isBusy: boolean;
  onLogin(payload: LoginRequest): Promise<void>;
}

interface LoginFormState {
  password: string;
  username: string;
}

const DEFAULT_FORM_STATE: LoginFormState = {
  password: "",
  username: "",
};
const DIALOG_TITLE = "Login";
const LOGIN_BUTTON_LABEL = "Login";
const SUBMIT_BUTTON_LABEL = "Log In";
const DIALOG_MAX_WIDTH = "xs";
const FORM_GAP = 2;
const DIALOG_ACTIONS_PADDING = 3;
const DIALOG_ACTIONS_TOP_PADDING = 1;
const LOGIN_FAILURE_TITLE = "Login Failed";
const DEFAULT_LOGIN_FAILURE_MESSAGE = "Login failed.";

interface FeedbackState {
  isOpen: boolean;
  message: string;
}

const DEFAULT_FEEDBACK_STATE: FeedbackState = {
  isOpen: false,
  message: "",
};

function toLoginPayload(formState: LoginFormState): LoginRequest {
  return {
    password: formState.password,
    username: formState.username,
  };
}

export function LoginButton({ isBusy, onLogin }: LoginButtonProps) {
  const [formState, setFormState] = useState<LoginFormState>(DEFAULT_FORM_STATE);
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
      await onLogin(toLoginPayload(formState));
      closeDialog();
    } catch (error) {
      closeDialog();
      setFeedbackState({
        isOpen: true,
        message: buildLoginFailureMessage(error),
      });
    }
  }

  function closeFeedbackDialog(): void {
    setFeedbackState(DEFAULT_FEEDBACK_STATE);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submitLogin();
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

  return (
    <>
      <Button onClick={openDialog} variant="outlined">
        {LOGIN_BUTTON_LABEL}
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
        title={LOGIN_FAILURE_TITLE}
      />
    </>
  );
}
