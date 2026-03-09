import React from "react";
import { EntityActionButton } from "./EntityActionButton.js";

interface OrganizationCreateButtonProps {
  disabled?: boolean;
  onClick(): void;
}

export function OrganizationCreateButton(props: OrganizationCreateButtonProps) {
  return (
    <EntityActionButton
      disabled={props.disabled}
      label="Create Organization"
      onClick={props.onClick}
      variant="contained"
    />
  );
}
