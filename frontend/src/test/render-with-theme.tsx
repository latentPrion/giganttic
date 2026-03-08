import React, { type ReactElement } from "react";
import { render } from "@testing-library/react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { MemoryRouter } from "react-router-dom";

import { appTheme } from "../theme/app-theme.js";

interface RenderWithThemeOptions {
  initialEntries?: string[];
}

export function renderWithTheme(
  element: ReactElement,
  options: RenderWithThemeOptions = {},
) {
  return render(
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <MemoryRouter
        future={{
          v7_relativeSplatPath: true,
          v7_startTransition: true,
        }}
        initialEntries={options.initialEntries}
      >
        {element}
      </MemoryRouter>
    </ThemeProvider>,
  );
}
