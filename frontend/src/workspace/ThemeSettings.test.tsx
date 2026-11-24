import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ThemeSettings } from "./ThemeSettings";
import { applyWorkspaceTheme, CUSTOM_THEMES_STORAGE_KEY, DEFAULT_THEME, getWorkspaceTheme, initializeWorkspaceTheme, loadCustomThemes, saveCustomTheme, THEME_PRESETS } from "./themes";

afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); applyWorkspaceTheme(DEFAULT_THEME); });

function Harness() {
  const [theme, setTheme] = useState(getWorkspaceTheme());
  return <ThemeSettings theme={theme} onThemeChange={(next) => { applyWorkspaceTheme(next, true); setTheme(next); }} />;
}

describe("custom theme workflow", () => {
  it("creates from the current palette, applies every color immediately and restores library and selection after reload", () => {
    const { unmount } = render(<Harness />);
    expect(within(screen.getByLabelText("Built-in themes")).getAllByRole("button")).toHaveLength(THEME_PRESETS.length);
    fireEvent.change(screen.getByLabelText("Buy"), { target: { value: "#779922" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Add theme" }));
    fireEvent.change(screen.getByLabelText("Theme name"), { target: { value: "My gold theme" } });
    fireEvent.change(screen.getByLabelText("Rise HEX"), { target: { value: "#abcdef" } });
    fireEvent.change(screen.getByLabelText("Fall HEX"), { target: { value: "#fedcba" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(getWorkspaceTheme().preset).toBe("Custom");
    expect(loadCustomThemes()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(getWorkspaceTheme()).toEqual({ ...DEFAULT_THEME, preset: "My gold theme", rise: "#abcdef", fall: "#fedcba", buy: "#779922" });
    expect(document.documentElement.style.getPropertyValue("--workspace-rise")).toBe("#abcdef");
    expect(document.documentElement.style.getPropertyValue("--workspace-fall")).toBe("#fedcba");
    unmount();
    applyWorkspaceTheme(DEFAULT_THEME);
    const cleanup = initializeWorkspaceTheme();
    render(<Harness />);
    expect(getWorkspaceTheme().preset).toBe("My gold theme");
    expect(screen.getByRole("button", { name: "My gold theme" })).toHaveAttribute("aria-pressed", "true");
    expect(loadCustomThemes()[0].theme).toEqual(getWorkspaceTheme());
    cleanup();
  });

  it("edits the saved entry, keeps user-entered names, and does not apply cancelled drafts", () => {
    const saved = saveCustomTheme({ ...DEFAULT_THEME, preset: "Góc riêng" });
    expect(saved.error).toBeUndefined();
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Edit theme Góc riêng" }));
    fireEvent.change(screen.getByLabelText("Accent HEX"), { target: { value: "#112233" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(loadCustomThemes()[0].id).toBe(saved.entry?.id);
    expect(loadCustomThemes()[0].theme.accent).toBe("#112233");
    expect(getWorkspaceTheme()).toEqual(DEFAULT_THEME);
    fireEvent.change(screen.getByLabelText("Rise HEX"), { target: { value: "#999999" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(loadCustomThemes()[0].theme.rise).toBe(DEFAULT_THEME.rise);
    fireEvent.click(screen.getByRole("button", { name: "Góc riêng" }));
    expect(getWorkspaceTheme().accent).toBe("#112233");
  });

  it("rejects empty, reserved and duplicate names plus invalid HEX values", () => {
    saveCustomTheme({ ...DEFAULT_THEME, preset: "Desk" });
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add theme" }));
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Theme name"), { target: { value: "system dark" } });
    expect(screen.getByText(/different from the built-in/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Theme name"), { target: { value: " desk " } });
    expect(screen.getByText(/already exists/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Theme name"), { target: { value: "New desk" } });
    fireEvent.change(screen.getByLabelText("Text HEX"), { target: { value: "#xyz123" } });
    expect(screen.getByLabelText("Text HEX")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(loadCustomThemes()).toHaveLength(1);
  });

  it("shows failed persistence without changing the active palette or claiming success", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add theme" }));
    fireEvent.change(screen.getByLabelText("Theme name"), { target: { value: "New desk" } });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be saved/);
    expect(getWorkspaceTheme()).toEqual(DEFAULT_THEME);
    expect(screen.queryByText("Theme saved and applied.")).not.toBeInTheDocument();
  });

  it("refreshes the library when another tab stores a theme and ignores malformed entries", () => {
    localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify([{ id: "bad", theme: { preset: "Bad", background: "red" } }]));
    render(<Harness />);
    expect(screen.queryByRole("button", { name: "Bad" })).not.toBeInTheDocument();
    saveCustomTheme({ ...DEFAULT_THEME, preset: "Other tab" });
    fireEvent(window, new StorageEvent("storage", { key: CUSTOM_THEMES_STORAGE_KEY }));
    expect(screen.getByRole("button", { name: "Other tab" })).toBeInTheDocument();
  });
});
