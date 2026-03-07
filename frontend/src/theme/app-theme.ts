import { createTheme } from "@mui/material";

const PRIMARY_MAIN = "#cf7a3e";
const PRIMARY_DARK = "#7a3b1a";
const SECONDARY_MAIN = "#2f90b8";
const PAPER_BACKGROUND = "rgba(20, 24, 33, 0.9)";
const DEFAULT_BACKGROUND = "#11161e";
const FIELD_BACKGROUND = "rgba(40, 47, 61, 0.96)";
const FIELD_HOVER_BACKGROUND = "rgba(47, 55, 70, 0.98)";
const FIELD_FOCUS_BACKGROUND = "rgba(30, 37, 49, 1)";
const FIELD_TEXT = "#f4efe5";
const FIELD_LABEL = "rgba(244, 239, 229, 0.7)";
const FIELD_BORDER = "rgba(255, 255, 255, 0.16)";
const FIELD_HOVER_BORDER = "rgba(207, 122, 62, 0.5)";

export const appTheme = createTheme({
  components: {
    MuiOutlinedInput: {
      styleOverrides: {
        input: {
          color: FIELD_TEXT,
        },
        notchedOutline: {
          borderColor: FIELD_BORDER,
        },
        root: {
          backgroundColor: FIELD_BACKGROUND,
          transition: "background-color 140ms ease, border-color 140ms ease",
          "&.Mui-focused": {
            backgroundColor: FIELD_FOCUS_BACKGROUND,
          },
          "&:hover": {
            backgroundColor: FIELD_HOVER_BACKGROUND,
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: FIELD_HOVER_BORDER,
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: FIELD_LABEL,
        },
      },
    },
  },
  palette: {
    background: {
      default: DEFAULT_BACKGROUND,
      paper: PAPER_BACKGROUND,
    },
    primary: {
      dark: PRIMARY_DARK,
      main: PRIMARY_MAIN,
    },
    secondary: {
      main: SECONDARY_MAIN,
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
