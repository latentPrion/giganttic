import React from "react";
import { EntityActionButton } from "./EntityActionButton.js";

interface UserDeleteButtonProps {
  disabled?: boolean;
  label?: string;
  onClick(): void;
}

export function UserDeleteButton(props: UserDeleteButtonProps) {
  return (
    <EntityActionButton
      color="error"
      disabled={props.disabled}
      label={props.label ?? "Delete"}
      onClick={props.onClick}
    />
  );
}
