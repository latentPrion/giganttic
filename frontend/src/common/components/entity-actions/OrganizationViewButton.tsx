import React from "react";
import { EntityActionButton } from "./EntityActionButton.js";

interface OrganizationViewButtonProps {
  disabled?: boolean;
  onClick(): void;
}

export function OrganizationViewButton(props: OrganizationViewButtonProps) {
  return (
    <EntityActionButton
      disabled={props.disabled}
      label="View"
      onClick={props.onClick}
    />
  );
}
