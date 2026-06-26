"use client";

import { Info } from "@phosphor-icons/react";
import { useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";

export function InfoHint({ label }: { label: string }) {
  const tooltipId = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties | null>(null);

  const positionTooltip = () => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const edge = 12;
    const gap = 8;
    const width = Math.min(280, Math.max(190, window.innerWidth - edge * 2));
    const height = tooltipRef.current?.offsetHeight ?? 64;
    const roomAbove = rect.top - gap - edge;
    const roomBelow = window.innerHeight - rect.bottom - gap - edge;
    const showBelow = roomBelow >= height || roomBelow >= roomAbove;
    const top = showBelow
      ? clampNumber(rect.bottom + gap, edge, window.innerHeight - height - edge)
      : clampNumber(rect.top - height - gap, edge, window.innerHeight - height - edge);
    const left = clampNumber(
      rect.left + rect.width / 2 - width / 2,
      edge,
      window.innerWidth - width - edge
    );
    setTooltipStyle({
      position: "fixed",
      left,
      top,
      width,
      zIndex: 9999
    });
  };

  const showTooltip = () => {
    setOpen(true);
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(positionTooltip);
  };

  const hideTooltip = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    setOpen(false);
    setTooltipStyle(null);
  };

  useLayoutEffect(() => {
    if (!open) return;
    positionTooltip();
    window.addEventListener("resize", positionTooltip);
    window.addEventListener("scroll", positionTooltip, true);
    return () => {
      window.removeEventListener("resize", positionTooltip);
      window.removeEventListener("scroll", positionTooltip, true);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [open, label]);

  return (
    <span className="info-hint">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-describedby={open ? tooltipId : undefined}
        className="info-hint-trigger"
        onBlur={hideTooltip}
        onFocus={showTooltip}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onKeyDown={(event) => {
          if (event.key === "Escape") hideTooltip();
        }}
      >
        <Info aria-hidden="true" weight="bold" className="size-3.5" />
      </button>
      {open
        ? createPortal(
            <span
              id={tooltipId}
              ref={tooltipRef}
              role="tooltip"
              className="info-hint-tooltip"
              style={tooltipStyle ?? hiddenTooltipStyle}
            >
              {label}
            </span>,
            document.body
          )
        : null}
    </span>
  );
}

const hiddenTooltipStyle: CSSProperties = {
  position: "fixed",
  left: 0,
  top: 0,
  visibility: "hidden",
  zIndex: 9999
};

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
