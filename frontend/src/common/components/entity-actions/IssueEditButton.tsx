import React from "react";
import { EntityActionButton } from "./EntityActionButton.js";

interface IssueEditButtonProps {
  disabled?: boolean;
  onClick(): void;
}

export function IssueEditButton(props: IssueEditButtonProps) {
  return (
    <EntityActionButton
      disabled={props.disabled}
      label="Edit"
      onClick={props.onClick}
    />
  );
}
