import React from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithTheme } from "../../../../test/render-with-theme.js";
import { IssueFormFields } from "./IssueFormFields.js";

describe("IssueFormFields", () => {
  it("constrains progress percentage input to the inclusive 0-100 range", () => {
    renderWithTheme(
      <IssueFormFields
        formState={{
          closedReason: "",
          closedReasonDescription: "",
          description: "",
          journal: "",
          name: "",
          priority: "0",
          progressPercentage: "0",
          status: "ISSUE_STATUS_OPEN",
        }}
        onFieldChange={vi.fn()}
      />,
    );

    const progressInput = screen.getByRole("spinbutton", { name: "Progress Percentage" });

    expect(progressInput).toHaveAttribute("min", "0");
    expect(progressInput).toHaveAttribute("max", "100");
  });
});
