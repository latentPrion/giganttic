import React from "react";
import { EntityActionButton } from "./EntityActionButton.js";

interface TeamEditButtonProps {
  disabled?: boolean;
  onClick(): void;
}

export function TeamEditButton(props: TeamEditButtonProps) {
  return (
    <EntityActionButton
      disabled={props.disabled}
      label="Edit"
      onClick={props.onClick}
    />
  );
}
