import React from "react";
import { EntityActionButton } from "./EntityActionButton.js";

interface IssueDeleteButtonProps {
  disabled?: boolean;
  onClick(): void;
}

export function IssueDeleteButton(props: IssueDeleteButtonProps) {
  return (
    <EntityActionButton
      color="error"
      disabled={props.disabled}
      label="Delete"
      onClick={props.onClick}
    />
  );
}
