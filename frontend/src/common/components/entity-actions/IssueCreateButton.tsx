import React from "react";
import { EntityActionButton } from "./EntityActionButton.js";

interface IssueCreateButtonProps {
  disabled?: boolean;
  onClick(): void;
}

export function IssueCreateButton(props: IssueCreateButtonProps) {
  return (
    <EntityActionButton
      disabled={props.disabled}
      label="Create Issue"
      onClick={props.onClick}
      variant="contained"
    />
  );
}
