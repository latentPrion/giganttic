import React from "react";
import { Button } from "@mui/material";

interface EntityActionButtonProps {
  color?: "error" | "inherit" | "primary" | "secondary" | "success" | "warning";
  disabled?: boolean;
  label: string;
  onClick(): void;
  variant?: "contained" | "outlined" | "text";
}

const DEFAULT_VARIANT = "outlined";

export function EntityActionButton(props: EntityActionButtonProps) {
  return (
    <Button
      color={props.color}
      disabled={props.disabled}
      onClick={props.onClick}
      variant={props.variant ?? DEFAULT_VARIANT}
    >
      {props.label}
    </Button>
  );
}
