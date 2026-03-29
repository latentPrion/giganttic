import React from "react";
import {
  Divider,
  Link,
  Stack,
} from "@mui/material";

const GITHUB_HREF = "https://github.com/latentprion";
const GITHUB_LABEL = "Github";
const LINKEDIN_HREF = "https://www.linkedin.com/in/kofi-doku-atuah-0142054a/";
const LINKEDIN_LABEL = "LinkedIn";

export function HomeProfileLinks() {
  return (
    <Stack
      direction={{ sm: "row", xs: "column" }}
      justifyContent="center"
      spacing={2}
      sx={(theme) => ({
        alignItems: "center",
        backgroundColor: theme.palette.action.hover,
        border: 1,
        borderColor: theme.palette.divider,
        borderRadius: 999,
        padding: "0.5rem 1.25rem",
        width: "100%",
      })}
    >
      <Link href={GITHUB_HREF} rel="noreferrer" target="_blank" underline="hover">
        {GITHUB_LABEL}
      </Link>
      <Divider
        flexItem
        orientation="vertical"
        sx={{ display: { sm: "block", xs: "none" } }}
      />
      <Divider
        flexItem
        sx={{ display: { sm: "none", xs: "block" } }}
      />
      <Link href={LINKEDIN_HREF} rel="noreferrer" target="_blank" underline="hover">
        {LINKEDIN_LABEL}
      </Link>
    </Stack>
  );
}
