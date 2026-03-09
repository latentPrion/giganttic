import React from "react";
import { EntityActionButton } from "./EntityActionButton.js";

interface ProjectCreateButtonProps {
  disabled?: boolean;
  onClick(): void;
}

export function ProjectCreateButton(props: ProjectCreateButtonProps) {
  return (
    <EntityActionButton
      disabled={props.disabled}
      label="Create Project"
      onClick={props.onClick}
      variant="contained"
    />
  );
}
