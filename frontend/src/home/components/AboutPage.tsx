import React from "react";

import { HomeInfoPage } from "./HomeInfoPage.js";
import { HomeProfileLinks } from "./HomeProfileLinks.js";

const ABOUT_BODY =
  "Giganttic is built by LatentPrion and designed as a structured workspace for organizing projects, teams, and organizations with clear access control and session-aware tooling.";

export function AboutPage() {
  return (
    <HomeInfoPage
      body={ABOUT_BODY}
      footerContent={<HomeProfileLinks />}
      title="About"
    />
  );
}
