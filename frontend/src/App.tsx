import React from "react";

import { AppRoutes } from "./app/AppRoutes.js";
import { AuthSessionProvider } from "./auth/context/AuthSessionContext.js";
import "./styles/app.css";

export function App() {
  return (
    <AuthSessionProvider>
      <AppRoutes />
    </AuthSessionProvider>
  );
}
