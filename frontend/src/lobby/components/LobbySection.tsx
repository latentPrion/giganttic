import React from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

interface LobbySectionProps {
  children?: React.ReactNode;
  headerAction?: React.ReactNode;
  isOpen: boolean;
  title: string;
  onExpandedChange(expanded: boolean): void;
}

export function LobbySection(
  { children, headerAction, isOpen, onExpandedChange, title }: LobbySectionProps,
) {
  return (
    <Stack spacing={1}>
      {headerAction ? (
        <Stack
          alignItems="center"
          direction="row"
          justifyContent="flex-end"
        >
          {headerAction}
        </Stack>
      ) : null}
      <Accordion
        expanded={isOpen}
        onChange={(_, expanded) => onExpandedChange(expanded)}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">{title}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.5}>{children}</Stack>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
}
