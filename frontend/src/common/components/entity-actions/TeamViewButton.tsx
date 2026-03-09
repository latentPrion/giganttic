import React from "react";
import { EntityActionButton } from "./EntityActionButton.js";

interface TeamViewButtonProps {
  disabled?: boolean;
  onClick(): void;
}

export function TeamViewButton(props: TeamViewButtonProps) {
  return (
    <EntityActionButton
      disabled={props.disabled}
      label="View"
      onClick={props.onClick}
    />
  );
}
