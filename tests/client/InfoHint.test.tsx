import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InfoHint } from "@/components/InfoHint";

describe("InfoHint", () => {
  it("renders its tooltip outside clipping containers", async () => {
    render(
      <div data-testid="clipper" className="overflow-hidden">
        <InfoHint label="Tooltip text should escape the clipping container." />
      </div>
    );

    const button = screen.getByRole("button", {
      name: "Tooltip text should escape the clipping container."
    });
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue({
      left: 120,
      top: 80,
      width: 20,
      height: 20,
      right: 140,
      bottom: 100,
      x: 120,
      y: 80,
      toJSON: () => ({})
    } as DOMRect);

    await userEvent.hover(button);

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Tooltip text should escape the clipping container.");
    expect(screen.getByTestId("clipper")).not.toContainElement(tooltip);
    expect(tooltip.parentElement).toBe(document.body);
    expect(tooltip).toHaveStyle({ position: "fixed" });
  });

  it("keeps the tooltip inside the viewport near the bottom edge", async () => {
    vi.stubGlobal("innerWidth", 320);
    vi.stubGlobal("innerHeight", 180);
    render(<InfoHint label="Bottom edge tooltip should flip upward." />);

    const button = screen.getByRole("button", {
      name: "Bottom edge tooltip should flip upward."
    });
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue({
      left: 250,
      top: 150,
      width: 20,
      height: 20,
      right: 270,
      bottom: 170,
      x: 250,
      y: 150,
      toJSON: () => ({})
    } as DOMRect);

    await userEvent.hover(button);

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveStyle({ position: "fixed" });
    expect(parseFloat(tooltip.style.top)).toBeLessThan(150);
    expect(parseFloat(tooltip.style.left)).toBeLessThanOrEqual(118);
  });
});
