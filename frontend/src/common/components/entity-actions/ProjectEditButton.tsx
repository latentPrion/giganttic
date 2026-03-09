import React from "react";
import { EntityActionButton } from "./EntityActionButton.js";

interface ProjectEditButtonProps {
  disabled?: boolean;
  onClick(): void;
}

export function ProjectEditButton(props: ProjectEditButtonProps) {
  return (
    <EntityActionButton
      disabled={props.disabled}
      label="Edit"
      onClick={props.onClick}
    />
  );
}
