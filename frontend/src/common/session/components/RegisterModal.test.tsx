import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithTheme } from "../../../test/render-with-theme.js";
import { RegisterModal } from "./RegisterModal.js";

const USERNAME_LABEL = "Username";
const EMAIL_LABEL = "Email";
const PASSWORD_LABEL = "Password";
const CONFIRM_PASSWORD_LABEL = "Confirm Password";
const CREATE_ACCOUNT_BUTTON_LABEL = "Create Account";
const PASSWORD_MISMATCH_MESSAGE = "Passwords do not match.";

function renderRegisterModal(overrides: Partial<React.ComponentProps<typeof RegisterModal>> = {}) {
  const onClose = vi.fn();
  const onRegister = vi.fn().mockResolvedValue(undefined);

  renderWithTheme(
    <RegisterModal
      isBusy={false}
      isOpen
      onClose={onClose}
      onRegister={onRegister}
      {...overrides}
    />,
  );

  return {
    onClose,
    onRegister,
  };
}

async function fillRegisterForm(
  user: ReturnType<typeof userEvent.setup>,
  values: {
    confirmPassword: string;
    email: string;
    password: string;
    username: string;
  },
) {
  await user.type(screen.getByLabelText(USERNAME_LABEL), values.username);
  await user.type(screen.getByLabelText(EMAIL_LABEL), values.email);
  await user.type(screen.getByLabelText(PASSWORD_LABEL), values.password);
  await user.type(screen.getByLabelText(CONFIRM_PASSWORD_LABEL), values.confirmPassword);
}

describe("RegisterModal", () => {
  it("does not submit registration when the passwords do not match", async () => {
    const user = userEvent.setup();
    const { onRegister } = renderRegisterModal();

    await fillRegisterForm(user, {
      confirmPassword: "secret-2",
      email: "demo@example.com",
      password: "secret-1",
      username: "demo-user",
    });
    await user.click(screen.getByRole("button", { name: CREATE_ACCOUNT_BUTTON_LABEL }));

    expect(onRegister).not.toHaveBeenCalled();
    expect(screen.getByText(PASSWORD_MISMATCH_MESSAGE)).toBeVisible();
  });

  it("submits registration when the password confirmation matches", async () => {
    const user = userEvent.setup();
    const { onRegister } = renderRegisterModal();

    await fillRegisterForm(user, {
      confirmPassword: "secret-1",
      email: "demo@example.com",
      password: "secret-1",
      username: "demo-user",
    });
    await user.click(screen.getByRole("button", { name: CREATE_ACCOUNT_BUTTON_LABEL }));

    expect(onRegister).toHaveBeenCalledWith({
      email: "demo@example.com",
      password: "secret-1",
      username: "demo-user",
    });
  });

  it("clears the mismatch message after the user updates a password field", async () => {
    const user = userEvent.setup();
    renderRegisterModal();

    await fillRegisterForm(user, {
      confirmPassword: "secret-2",
      email: "demo@example.com",
      password: "secret-1",
      username: "demo-user",
    });
    await user.click(screen.getByRole("button", { name: CREATE_ACCOUNT_BUTTON_LABEL }));
    expect(screen.getByText(PASSWORD_MISMATCH_MESSAGE)).toBeVisible();

    await user.type(screen.getByLabelText(CONFIRM_PASSWORD_LABEL), "3");

    expect(screen.queryByText(PASSWORD_MISMATCH_MESSAGE)).not.toBeInTheDocument();
  });
});
