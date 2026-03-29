import React from "react";
import { TextField } from "@mui/material";

interface ProjectFormState {
  description: string;
  name: string;
}

interface ProjectFormFieldsProps {
  nameInputRef?: React.RefObject<HTMLInputElement | null>;
  formState: ProjectFormState;
  onFieldChange<K extends keyof ProjectFormState>(
    key: K,
    value: ProjectFormState[K],
  ): void;
}

export function ProjectFormFields(props: ProjectFormFieldsProps) {
  return (
    <>
      <TextField
        inputRef={props.nameInputRef}
        label="Name"
        onChange={(event) => props.onFieldChange("name", event.target.value)}
        value={props.formState.name}
      />
      <TextField
        label="Description"
        minRows={3}
        multiline
        onChange={(event) => props.onFieldChange("description", event.target.value)}
        value={props.formState.description}
      />
    </>
  );
}
