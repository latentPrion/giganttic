import React from "react";
import { Stack } from "@mui/material";

import type {
  LoginRequest,
  RegisterRequest,
} from "../contracts/auth.contracts.js";
import { LoginButton } from "./LoginButton.js";
import { RegisterButton } from "./RegisterButton.js";

interface LoggedOutSessionManagerProps {
  isBusy: boolean;
  onLogin(payload: LoginRequest): Promise<void>;
  onRegister(payload: RegisterRequest): Promise<void>;
}

export function LoggedOutSessionManager(
  props: LoggedOutSessionManagerProps,
) {
  return (
    <Stack direction="row" spacing={1.5}>
      <LoginButton isBusy={props.isBusy} onLogin={props.onLogin} />
      <RegisterButton isBusy={props.isBusy} onRegister={props.onRegister} />
    </Stack>
  );
}
