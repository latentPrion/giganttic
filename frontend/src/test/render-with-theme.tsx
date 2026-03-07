import React, { type ReactElement } from "react";
import { render } from "@testing-library/react";
import { CssBaseline, ThemeProvider } from "@mui/material";

import { AuthSessionProvider } from "../auth/context/AuthSessionContext.js";
import { appTheme } from "../theme/app-theme.js";

export function renderWithTheme(element: ReactElement) {
  return render(
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <AuthSessionProvider>{element}</AuthSessionProvider>
    </ThemeProvider>,
  );
}
