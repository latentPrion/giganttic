import React from "react";
import { Link } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

const NAV_LINK_COLOR = "rgba(255, 255, 255, 0.82)";

export function PublicHomeNavigation() {
  return (
    <>
      <Link
        color={NAV_LINK_COLOR}
        component={RouterLink}
        to="/about"
        underline="hover"
      >
        About
      </Link>
      <Link
        color={NAV_LINK_COLOR}
        component={RouterLink}
        to="/contact"
        underline="hover"
      >
        Contact
      </Link>
    </>
  );
}
