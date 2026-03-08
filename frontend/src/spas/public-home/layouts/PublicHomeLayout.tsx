import React from "react";
import { Outlet } from "react-router-dom";

import { AppShell } from "../../../app/shell/AppShell.js";
import { PublicHomeNavigation } from "../components/PublicHomeNavigation.js";

export function PublicHomeLayout() {
  return (
    <AppShell navigation={<PublicHomeNavigation />}>
      <Outlet />
    </AppShell>
  );
}
