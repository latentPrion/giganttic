import React from "react";
import { EntityActionButton } from "./EntityActionButton.js";

interface UserCreateButtonProps {
  disabled?: boolean;
  onClick(): void;
}

export function UserCreateButton(props: UserCreateButtonProps) {
  return (
    <EntityActionButton
      disabled={props.disabled}
      label="Create User"
      onClick={props.onClick}
      variant="contained"
    />
  );
}
