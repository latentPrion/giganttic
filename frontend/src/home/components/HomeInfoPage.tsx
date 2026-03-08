import React from "react";
import {
  Box,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

interface HomeInfoPageProps {
  body: string;
  title: string;
}

export function HomeInfoPage({ body, title }: HomeInfoPageProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flex: 1,
        justifyContent: "center",
        padding: { xs: 1.5, sm: 2 },
        width: "100%",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: 832,
          padding: { xs: 1.75, sm: 2.5 },
          width: "100%",
        }}
      >
        <Stack spacing={2}>
          <Typography component="h1" variant="h3">
            {title}
          </Typography>
          <Typography color="text.secondary" variant="body1" sx={{ lineHeight: 1.75 }}>
            {body}
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
