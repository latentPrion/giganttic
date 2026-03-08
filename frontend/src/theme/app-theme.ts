import { createTheme } from "@mui/material";

export const appTheme = createTheme({
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          margin: 0,
          overflowX: "hidden",
        },
        "#root": {
          minHeight: "100dvh",
        },
      },
    },
  },
  palette: {
    mode: "dark",
    primary: {
      main: "#cf7a3e",
      dark: "#7a3b1a",
    },
    secondary: {
      main: "#2f90b8",
    },
  },
  shape: {
    borderRadius: 14,
  },
  typography: {
    button: {
      fontWeight: 700,
      letterSpacing: "0.04em",
      textTransform: "none",
    },
    fontFamily: "\"Segoe UI\", Tahoma, Geneva, Verdana, sans-serif",
    h6: {
      fontWeight: 800,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
    },
  },
});
