import React, { useState } from "react";
import { Button } from "@mui/material";

import type { RegisterRequest } from "../contracts/auth.contracts.js";
import { RegisterModal } from "./RegisterModal.js";

interface RegisterButtonProps {
  isBusy: boolean;
  onRegister(payload: RegisterRequest): Promise<void>;
  size?: "large" | "medium" | "small";
  successReturnFocusRef?: React.RefObject<HTMLElement | null>;
}

const REGISTER_BUTTON_LABEL = "Register";

export function RegisterButton(props: RegisterButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  function closeDialog(): void {
    setIsOpen(false);
  }

  function openDialog(): void {
    setIsOpen(true);
  }

  return (
    <>
      <Button onClick={openDialog} size={props.size} variant="contained">
        {REGISTER_BUTTON_LABEL}
      </Button>
      <RegisterModal
        isBusy={props.isBusy}
        isOpen={isOpen}
        onClose={closeDialog}
        onRegister={props.onRegister}
        successReturnFocusRef={props.successReturnFocusRef}
      />
    </>
  );
}
