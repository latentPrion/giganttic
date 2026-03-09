import React from "react";
import { EntityActionButton } from "./EntityActionButton.js";

interface TeamCreateButtonProps {
  disabled?: boolean;
  onClick(): void;
}

export function TeamCreateButton(props: TeamCreateButtonProps) {
  return (
    <EntityActionButton
      disabled={props.disabled}
      label="Create Team"
      onClick={props.onClick}
      variant="contained"
    />
  );
}
