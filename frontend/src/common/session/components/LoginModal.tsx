import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";

import { getApiErrorMessage, isApiError } from "../../api/api-error.js";
import type { LoginRequest } from "../contracts/auth.contracts.js";
import { parseScopedAccessTokenInput } from "../utils/scoped-access-token-input.utils.js";
import { AuthStatusDialog } from "./AuthStatusDialog.js";

interface LoginModalProps {
  isBusy: boolean;
  isOpen: boolean;
  onClose(): void;
  onLogin(payload: LoginRequest): Promise<void>;
  onLoginWithScopedAccessToken(token: string): Promise<void>;
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
const PASSWORD_SUBMIT_BUTTON_LABEL = "Log In";
const SCOPED_TOKEN_FIELD_LABEL = "Token or login URL";
const SCOPED_TOKEN_SUBMIT_BUTTON_LABEL = "Log In";
const PASSKEY_MESSAGE = "Support coming soon.";
const FALLBACK_RELATIVE_URL_BASE = "https://localhost";

const LOGIN_TAB_VALUES = ["password", "scoped-token", "passkey"] as const;
type LoginModalTab = typeof LOGIN_TAB_VALUES[number];

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

  return getApiErrorMessage(error, DEFAULT_LOGIN_FAILURE_MESSAGE);
}

function resolveBaseUrlForScopedTokenParsing(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return FALLBACK_RELATIVE_URL_BASE;
}

function isLoginModalTab(value: string): value is LoginModalTab {
  return (LOGIN_TAB_VALUES as readonly string[]).includes(value);
}

export function LoginModal(props: LoginModalProps) {
  const [activeTab, setActiveTab] = useState<LoginModalTab>("password");
  const [formState, setFormState] = useState<LoginFormState>(DEFAULT_FORM_STATE);
  const [scopedTokenInput, setScopedTokenInput] = useState("");
  const [feedbackState, setFeedbackState] = useState<FeedbackState>(DEFAULT_FEEDBACK_STATE);
  const usernameInputReference = useRef<HTMLInputElement | null>(null);
  const scopedTokenInputReference = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!props.isOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (activeTab === "password") {
        usernameInputReference.current?.focus();
      } else if (activeTab === "scoped-token") {
        scopedTokenInputReference.current?.focus();
      }
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [props.isOpen, activeTab]);

  function closeDialog(): void {
    setFormState(DEFAULT_FORM_STATE);
    setScopedTokenInput("");
    setActiveTab("password");
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

  async function submitPasswordLogin(): Promise<void> {
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

  async function submitScopedTokenLogin(): Promise<void> {
    const baseUrl = resolveBaseUrlForScopedTokenParsing();
    const parsed = parseScopedAccessTokenInput(scopedTokenInput, baseUrl);
    if (!parsed) {
      closeDialog();
      setFeedbackState({
        isOpen: true,
        message: "Enter a scoped access token or a login URL that includes a token.",
      });
      return;
    }
    try {
      await props.onLoginWithScopedAccessToken(parsed);
      closeDialog();
    } catch (error) {
      closeDialog();
      setFeedbackState({
        isOpen: true,
        message: buildLoginFailureMessage(error),
      });
    }
  }

  function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submitPasswordLogin();
  }

  function handleScopedTokenSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submitScopedTokenLogin();
  }

  function handleTabChange(_event: React.SyntheticEvent, value: string): void {
    if (isLoginModalTab(value)) {
      setActiveTab(value);
    }
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
        <Box sx={{ borderBottom: 1, borderColor: "divider", px: 2, pt: 1 }}>
          <Tabs
            allowScrollButtonsMobile
            onChange={handleTabChange}
            scrollButtons="auto"
            value={activeTab}
            variant="scrollable"
          >
            <Tab label="Password" value="password" />
            <Tab label="Scoped Access Token" value="scoped-token" />
            <Tab label="Passkey" value="passkey" />
          </Tabs>
        </Box>
        {activeTab === "password" ? (
          <Box
            component="form"
            onSubmit={handlePasswordSubmit}
            sx={{ display: "flex", flexDirection: "column" }}
          >
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
                {PASSWORD_SUBMIT_BUTTON_LABEL}
              </Button>
            </DialogActions>
          </Box>
        ) : null}
        {activeTab === "scoped-token" ? (
          <Box
            component="form"
            onSubmit={handleScopedTokenSubmit}
            sx={{ display: "flex", flexDirection: "column" }}
          >
            <DialogContent sx={{ display: "grid", gap: FORM_GAP, paddingTop: FORM_GAP }}>
              <TextField
                inputRef={scopedTokenInputReference}
                label={SCOPED_TOKEN_FIELD_LABEL}
                minRows={3}
                multiline
                onChange={(event) => setScopedTokenInput(event.target.value)}
                value={scopedTokenInput}
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
                {SCOPED_TOKEN_SUBMIT_BUTTON_LABEL}
              </Button>
            </DialogActions>
          </Box>
        ) : null}
        {activeTab === "passkey" ? (
          <>
            <DialogContent sx={{ display: "grid", gap: FORM_GAP, paddingTop: FORM_GAP }}>
              <Typography color="text.secondary" variant="body2">
                {PASSKEY_MESSAGE}
              </Typography>
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
            </DialogActions>
          </>
        ) : null}
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
