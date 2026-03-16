import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";

interface EntityAssociationOption {
  id: number;
  name: string;
}

interface EntityAssociationModalProps {
  emptyMessage: string;
  isBusy: boolean;
  isOpen: boolean;
  onAssociate(entityId: number): Promise<void>;
  onClose(): void;
  options: EntityAssociationOption[];
  selectLabel: string;
  submitLabel: string;
  title: string;
}

export function EntityAssociationModal(props: EntityAssociationModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");

  const hasOptions = props.options.length > 0;
  const defaultSelectedId = useMemo(
    () => (hasOptions ? `${props.options[0]!.id}` : ""),
    [hasOptions, props.options],
  );

  useEffect(() => {
    if (!props.isOpen) {
      return;
    }

    setErrorMessage(null);
    setSelectedId(defaultSelectedId);
  }, [defaultSelectedId, props.isOpen]);

  function closeDialog(): void {
    setErrorMessage(null);
    setSelectedId("");
    props.onClose();
  }

  async function submitAssociation(): Promise<void> {
    const normalizedId = Number(selectedId);
    if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
      return;
    }

    try {
      await props.onAssociate(normalizedId);
      closeDialog();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save that association.");
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submitAssociation();
  }

  return (
    <Dialog fullWidth maxWidth="sm" onClose={closeDialog} open={props.isOpen}>
      <DialogTitle>{props.title}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ display: "grid", gap: 2, paddingTop: 2 }}>
          {hasOptions ? (
            <FormControl fullWidth>
              <InputLabel id={`${props.title}-label`}>{props.selectLabel}</InputLabel>
              <Select
                label={props.selectLabel}
                labelId={`${props.title}-label`}
                onChange={(event) => setSelectedId(`${event.target.value}`)}
                value={selectedId}
              >
                {props.options.map((option) => (
                  <MenuItem key={option.id} value={`${option.id}`}>
                    {option.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <Typography color="text.secondary" variant="body2">
              {props.emptyMessage}
            </Typography>
          )}
          {errorMessage ? (
            <Typography color="error.main" variant="body2">
              {errorMessage}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ padding: 3, paddingTop: 1 }}>
          <Button onClick={closeDialog} type="button">
            Cancel
          </Button>
          <Button disabled={props.isBusy || !hasOptions} type="submit" variant="contained">
            {props.submitLabel}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
