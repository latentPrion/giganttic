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
  isOpen: boolean;
  title: string;
  onExpandedChange(expanded: boolean): void;
}

export function LobbySection(
  { children, isOpen, onExpandedChange, title }: LobbySectionProps,
) {
  return (
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
  );
}
