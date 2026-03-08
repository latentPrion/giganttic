import React, { useRef } from "react";
import { Stack } from "@mui/material";

import type {
  LoginRequest,
  RegisterRequest,
} from "../contracts/auth.contracts.js";
import { LoginButton } from "./LoginButton.js";
import { RegisterButton } from "./RegisterButton.js";

interface LoggedOutSessionManagerProps {
  buttonSize?: "large" | "medium" | "small";
  isBusy: boolean;
  onLogin(payload: LoginRequest): Promise<void>;
  onRegister(payload: RegisterRequest): Promise<void>;
}

export function LoggedOutSessionManager(
  props: LoggedOutSessionManagerProps,
) {
  const loginButtonReference = useRef<HTMLButtonElement | null>(null);

  return (
    <Stack
      direction={{ sm: "row", xs: "column" }}
      spacing={1.5}
      sx={{ width: { sm: "auto", xs: "100%" } }}
    >
      <LoginButton
        isBusy={props.isBusy}
        onLogin={props.onLogin}
        size={props.buttonSize}
        triggerButtonRef={loginButtonReference}
      />
      <RegisterButton
        isBusy={props.isBusy}
        onRegister={props.onRegister}
        size={props.buttonSize}
        successReturnFocusRef={loginButtonReference}
      />
    </Stack>
  );
}
