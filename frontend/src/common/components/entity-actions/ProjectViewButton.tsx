import React from "react";
import { EntityActionButton } from "./EntityActionButton.js";

interface ProjectViewButtonProps {
  disabled?: boolean;
  onClick(): void;
}

export function ProjectViewButton(props: ProjectViewButtonProps) {
  return (
    <EntityActionButton
      disabled={props.disabled}
      label="View"
      onClick={props.onClick}
    />
  );
}
