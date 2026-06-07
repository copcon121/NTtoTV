import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Mt5AccountDialog } from "./Mt5AccountDialog";

describe("Mt5AccountDialog", () => {
  it("submits MT5 account config with a manual symbol override", () => {
    const onSubmit = vi.fn();
    render(
      <Mt5AccountDialog
        open
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Login"), {
      target: { value: "123456" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret" },
    });
    fireEvent.change(screen.getByLabelText("Server"), {
      target: { value: "Broker-Demo" },
    });
    fireEvent.change(screen.getByLabelText("Symbol"), {
      target: { value: "XAUUSDm" },
    });
    fireEvent.change(screen.getByLabelText("Terminal path"), {
      target: { value: "C:\\MT5\\terminal64.exe" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Account" }));

    expect(onSubmit).toHaveBeenCalledWith({
      login: 123456,
      password: "secret",
      server: "Broker-Demo",
      symbolBroker: "XAUUSDm",
      terminalPath: "C:\\MT5\\terminal64.exe",
    });
  });

  it("omits the symbol when left on auto detect", () => {
    const onSubmit = vi.fn();
    render(
      <Mt5AccountDialog
        open
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Login"), {
      target: { value: "123456" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret" },
    });
    fireEvent.change(screen.getByLabelText("Server"), {
      target: { value: "Broker-Demo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Account" }));

    expect(onSubmit).toHaveBeenCalledWith({
      login: 123456,
      password: "secret",
      server: "Broker-Demo",
      terminalPath: "C:\\Program Files\\MetaTrader 5\\terminal64.exe",
    });
  });
});
