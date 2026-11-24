import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { SiStopSettingsEditor } from "./SiStopSettingsEditor";
import { DEFAULT_SI_STOP_SETTINGS } from "./siStops";

describe("SI Stops settings", () => {
  it("replaces MV semantics with executed-chain filters and preserves separate alert thresholds", () => {
    function Editor() {
      const [settings, setSettings] = useState({ ...DEFAULT_SI_STOP_SETTINGS });
      return <SiStopSettingsEditor settings={settings} onChange={setSettings} />;
    }
    render(<Editor />);
    expect(screen.getByLabelText("Show SI Stops")).toBeChecked();
    expect(screen.getByRole("group", { name: "SI Stops" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "SI Stops display & alerts" })).toBeNull();
    expect(screen.getByLabelText("Minimum executed volume")).toHaveValue(50);
    expect(screen.getByLabelText("Alert minimum volume")).toHaveValue(10);
    fireEvent.click(screen.getByRole("button", { name: "Help for Automatic size filter" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Auto replaces the fixed Minimum executed volume threshold");
    expect(screen.getByLabelText("Automatic size filter")).not.toBeChecked();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.click(screen.getByLabelText("Automatic size filter"));
    expect(screen.getByLabelText("Minimum executed volume")).toBeDisabled();
    fireEvent.focus(screen.getByRole("button", { name: "Help for Minimum executed volume" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("EACH chain before grouping");
    expect(screen.getByLabelText("Sample interval (minutes)")).not.toBeDisabled();
    expect(screen.queryByText("Signal Level Ask")).toBeNull();
  });
});
