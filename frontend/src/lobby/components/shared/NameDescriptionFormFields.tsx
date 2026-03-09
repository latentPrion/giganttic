import React from "react";
import { TextField } from "@mui/material";

export interface NameDescriptionFormState {
  description: string;
  name: string;
}

interface NameDescriptionFormFieldsProps {
  formState: NameDescriptionFormState;
  nameInputRef?: React.RefObject<HTMLInputElement | null>;
  onFieldChange<K extends keyof NameDescriptionFormState>(
    key: K,
    value: NameDescriptionFormState[K],
  ): void;
}

export function NameDescriptionFormFields(props: NameDescriptionFormFieldsProps) {
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
