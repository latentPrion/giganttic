import React from "react";

import { HomeInfoPage } from "./HomeInfoPage.js";

const CONTACT_BODY =
  "Reach out to Giganttic for project coordination, implementation support, and product feedback. Contact workflows will expand here as the public site grows.";

export function ContactPage() {
  return <HomeInfoPage body={CONTACT_BODY} title="Contact" />;
}
