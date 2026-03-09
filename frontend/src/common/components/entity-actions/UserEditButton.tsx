import React from "react";
import { EntityActionButton } from "./EntityActionButton.js";

interface UserEditButtonProps {
  disabled?: boolean;
  onClick(): void;
}

export function UserEditButton(props: UserEditButtonProps) {
  return (
    <EntityActionButton
      disabled={props.disabled}
      label="Edit"
      onClick={props.onClick}
    />
  );
}
