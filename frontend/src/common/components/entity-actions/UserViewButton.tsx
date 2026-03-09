import React from "react";
import { EntityActionButton } from "./EntityActionButton.js";

interface UserViewButtonProps {
  disabled?: boolean;
  onClick(): void;
}

export function UserViewButton(props: UserViewButtonProps) {
  return (
    <EntityActionButton
      disabled={props.disabled}
      label="View"
      onClick={props.onClick}
    />
  );
}
