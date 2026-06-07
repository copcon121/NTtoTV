import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthDialog } from "./AuthDialog";

describe("AuthDialog", () => {
  it("submits login credentials", () => {
    const onSubmit = vi.fn();
    render(
      <AuthDialog
        open
        mode="login"
        onModeChange={vi.fn()}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    expect(onSubmit).toHaveBeenCalledWith({
      username: "alice",
      password: "secret",
      mode: "login",
    });
  });

  it("switches to create-account mode", () => {
    const onModeChange = vi.fn();
    render(
      <AuthDialog
        open
        mode="login"
        onModeChange={onModeChange}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Create" }));

    expect(onModeChange).toHaveBeenCalledWith("register");
  });

  it("submits invite code when creating an account", () => {
    const onSubmit = vi.fn();
    render(
      <AuthDialog
        open
        mode="register"
        onModeChange={vi.fn()}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "bob" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret" },
    });
    fireEvent.change(screen.getByLabelText("Invite code"), {
      target: { value: "join-9999" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    expect(onSubmit).toHaveBeenCalledWith({
      username: "bob",
      password: "secret",
      mode: "register",
      inviteCode: "join-9999",
    });
  });
});
