import { describe, expect, it } from "vitest";
import { resizeColumnWidth } from "@/lib/columnResize";

describe("column resizing", () => {
  it("bounds visible columns and collapses at the page edge", () => {
    expect(resizeColumnWidth(300, 60, "grow-right")).toEqual({
      collapsed: false,
      width: 360
    });
    expect(resizeColumnWidth(360, 80, "grow-left")).toEqual({
      collapsed: false,
      width: 280
    });
    expect(resizeColumnWidth(300, -260, "grow-right")).toEqual({
      collapsed: true,
      width: 44
    });
    expect(resizeColumnWidth(300, 900, "grow-right")).toEqual({
      collapsed: false,
      width: 560
    });
  });
});
