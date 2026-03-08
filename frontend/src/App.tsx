import React from "react";

import { AppRoutes } from "./app/AppRoutes.js";
import { AuthSessionProvider } from "./common/session/context/AuthSessionContext.js";

export function App() {
  return (
    <AuthSessionProvider>
      <AppRoutes />
    </AuthSessionProvider>
  );
}
