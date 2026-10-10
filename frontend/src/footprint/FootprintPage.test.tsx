import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FootprintPage } from "./FootprintPage";

vi.mock("../api/client", () => ({
  ApiClient: class {
    footprintDetails() {
      return new Promise(() => {});
    }
  },
}));

vi.mock("../socket/ChartSocket", () => ({
  ChartSocket: class {
    onOpen() {
      return () => {};
    }

    onClose() {
      return () => {};
    }

    on() {
      return () => {};
    }

    connect() {}

    ensureConnected() {}

    close() {}

    subscribe() {}

    unsubscribe() {}
  },
}));

vi.mock("./FootprintCanvas", () => ({
  FootprintCanvas: () => null,
}));

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("FootprintPage", () => {
  it("toggles all XKontrol levels without retaining the React event", () => {
    render(
      <StrictMode>
        <FootprintPage />
      </StrictMode>,
    );

    const levels = [
      screen.getByLabelText("XKontrol Level 1 Initial"),
      screen.getByLabelText("XKontrol Level 2 Strong"),
      screen.getByLabelText("XKontrol Level 3 Total"),
    ];

    for (const level of levels) {
      expect(level).toBeChecked();
      fireEvent.click(level);
      expect(level).not.toBeChecked();
    }
  });
});
