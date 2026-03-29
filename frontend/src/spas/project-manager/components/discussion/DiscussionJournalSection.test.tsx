import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithTheme } from "../../../../test/render-with-theme.js";
import { DiscussionJournalSection } from "./DiscussionJournalSection.js";

const EDITOR_HELP_TEXT =
  "To embed an attachment here, copy its ID from this issue's Attachments tab and use ![Alt text](gigantt://issue-attachment/<attachmentId>) for images or [Link text](gigantt://issue-attachment/<attachmentId>) for links. Only top-level issue attachments from this issue work here.";

describe("DiscussionJournalSection", () => {
  it("shows the attachment embedding help text while editing", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <DiscussionJournalSection
        canEdit
        editorHelpText={EDITOR_HELP_TEXT}
        errorMessage={null}
        isLoading={false}
        isSaving={false}
        journalExists
        markdown="Existing journal"
        onSave={vi.fn(async () => undefined)}
        renderMarkdown={(markdown) => <div>{markdown}</div>}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(await screen.findByText(EDITOR_HELP_TEXT)).toBeVisible();
  });
});
