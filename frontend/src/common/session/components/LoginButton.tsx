import React, { useState } from "react";
import { Button } from "@mui/material";

import type { LoginRequest } from "../contracts/auth.contracts.js";
import { LoginModal } from "./LoginModal.js";

interface LoginButtonProps {
  isBusy: boolean;
  onLogin(payload: LoginRequest): Promise<void>;
  size?: "large" | "medium" | "small";
  triggerButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

const LOGIN_BUTTON_LABEL = "Login";

export function LoginButton(props: LoginButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  function closeDialog(): void {
    setIsOpen(false);
  }

  function openDialog(): void {
    setIsOpen(true);
  }

  return (
    <>
      <Button
        onClick={openDialog}
        ref={props.triggerButtonRef}
        size={props.size}
        variant="outlined"
      >
        {LOGIN_BUTTON_LABEL}
      </Button>
      <LoginModal
        isBusy={props.isBusy}
        isOpen={isOpen}
        onClose={closeDialog}
        onLogin={props.onLogin}
      />
    </>
  );
}
