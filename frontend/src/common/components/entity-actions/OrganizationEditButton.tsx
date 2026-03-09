import React from "react";
import { EntityActionButton } from "./EntityActionButton.js";

interface OrganizationEditButtonProps {
  disabled?: boolean;
  onClick(): void;
}

export function OrganizationEditButton(props: OrganizationEditButtonProps) {
  return (
    <EntityActionButton
      disabled={props.disabled}
      label="Edit"
      onClick={props.onClick}
    />
  );
}
