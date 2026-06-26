import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ArtifactView } from "@/components/ArtifactView";

describe("ArtifactView", () => {
  it("starts collapsed, then preserves the reviewer's last open state", async () => {
    const { unmount } = render(
      <ArtifactView title="Ask" storageKey="test-ask">
        Ask body
      </ArtifactView>
    );

    const summary = screen.getByRole("heading", { name: "Ask" }).closest("summary");
    expect(summary?.parentElement).not.toHaveAttribute("open");

    await userEvent.click(summary as HTMLElement);

    expect(summary?.parentElement).toHaveAttribute("open");
    expect(window.localStorage.getItem("paper-lens:artifact:test-ask")).toBe("open");

    unmount();

    render(
      <ArtifactView title="Ask" storageKey="test-ask">
        Ask body
      </ArtifactView>
    );

    const restoredSummary = screen.getByRole("heading", { name: "Ask" }).closest("summary");
    await waitFor(() => expect(restoredSummary?.parentElement).toHaveAttribute("open"));

    await userEvent.click(restoredSummary as HTMLElement);

    expect(restoredSummary?.parentElement).not.toHaveAttribute("open");
    expect(window.localStorage.getItem("paper-lens:artifact:test-ask")).toBe("closed");
  });
});
