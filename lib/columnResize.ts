export interface ColumnResizeResult {
  collapsed: boolean;
  width: number;
}

export function resizeColumnWidth(
  startWidth: number,
  delta: number,
  direction: "grow-right" | "grow-left"
): ColumnResizeResult {
  const nextWidth = direction === "grow-right" ? startWidth + delta : startWidth - delta;
  if (nextWidth <= 70) return { collapsed: true, width: 44 };
  return { collapsed: false, width: Math.max(180, Math.min(560, nextWidth)) };
}
