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
    <Box className="home-page">
      <Paper className="home-page__paper" elevation={0}>
        <Stack spacing={2}>
          <Typography className="home-page__title" component="h1" variant="h3">
            {title}
          </Typography>
          <Typography className="home-page__body" variant="body1">
            {body}
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
