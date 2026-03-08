import React from "react";
import {
  Button,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

interface LobbySectionProps {
  children?: React.ReactNode;
  isOpen: boolean;
  title: string;
  onToggle(): void;
}

export function LobbySection(
  { children, isOpen, onToggle, title }: LobbySectionProps,
) {
  return (
    <Paper className="lobby-section" elevation={0}>
      <Button
        className="lobby-section__toggle"
        color="inherit"
        fullWidth
        onClick={onToggle}
        sx={{ justifyContent: "space-between" }}
      >
        <Typography component="span" variant="h6">
          {title}
        </Typography>
        <Typography component="span" variant="body2">
          {isOpen ? "Hide" : "Show"}
        </Typography>
      </Button>
      {isOpen ? (
        <Stack className="lobby-section__body" spacing={1.5}>
          {children}
        </Stack>
      ) : null}
    </Paper>
  );
}
