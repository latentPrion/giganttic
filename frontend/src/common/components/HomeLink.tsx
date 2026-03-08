import React from "react";
import { Link } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

interface HomeLinkProps {
  children?: React.ReactNode;
}

export function HomeLink({ children }: HomeLinkProps) {
  return (
    <Link component={RouterLink} to="/" underline="none" color="inherit">
      {children}
    </Link>
  );
}
