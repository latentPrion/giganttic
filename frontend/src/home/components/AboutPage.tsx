import React from "react";

import { HomeInfoPage } from "./HomeInfoPage.js";

const ABOUT_BODY =
  "Giganttic is a structured workspace for organizing projects, teams, and organizations with clear access control and session-aware tooling.";

export function AboutPage() {
  return <HomeInfoPage body={ABOUT_BODY} title="About" />;
}
