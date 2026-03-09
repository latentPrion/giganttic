import React from "react";
import { EntityActionButton } from "./EntityActionButton.js";

interface TeamDeleteButtonProps {
  disabled?: boolean;
  label?: string;
  onClick(): void;
}

const DEFAULT_LABEL = "Delete";

export function TeamDeleteButton(props: TeamDeleteButtonProps) {
  return (
    <EntityActionButton
      color="error"
      disabled={props.disabled}
      label={props.label ?? DEFAULT_LABEL}
      onClick={props.onClick}
    />
  );
}
