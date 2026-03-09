import React from "react";
import { EntityActionButton } from "./EntityActionButton.js";

interface OrganizationDeleteButtonProps {
  disabled?: boolean;
  label?: string;
  onClick(): void;
}

const DEFAULT_LABEL = "Delete";

export function OrganizationDeleteButton(props: OrganizationDeleteButtonProps) {
  return (
    <EntityActionButton
      color="error"
      disabled={props.disabled}
      label={props.label ?? DEFAULT_LABEL}
      onClick={props.onClick}
    />
  );
}
