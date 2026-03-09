import React from "react";
import { EntityActionButton } from "./EntityActionButton.js";

interface IssueViewButtonProps {
  disabled?: boolean;
  onClick(): void;
}

export function IssueViewButton(props: IssueViewButtonProps) {
  return (
    <EntityActionButton
      disabled={props.disabled}
      label="Open Issue"
      onClick={props.onClick}
    />
  );
}
