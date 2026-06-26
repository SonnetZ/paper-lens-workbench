"use client";

import { CaretDown } from "@phosphor-icons/react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { InfoHint } from "@/components/InfoHint";

gsap.registerPlugin(useGSAP);

export function ArtifactView({
  title,
  info,
  children,
  defaultOpen = false,
  storageKey
}: {
  title: string;
  info?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  storageKey?: string;
}) {
  const storageId = useMemo(
    () => `paper-lens:artifact:${storageKey ?? slugFromTitle(title)}`,
    [storageKey, title]
  );
  const [open, setOpen] = useState(defaultOpen);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setOpen(readStoredOpen(storageId, defaultOpen));
  }, [defaultOpen, storageId]);

  useGSAP(
    () => {
      if (!open || !bodyRef.current) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          bodyRef.current,
          { autoAlpha: 0, y: -4 },
          { autoAlpha: 1, y: 0, duration: 0.18, ease: "power2.out", clearProps: "all" }
        );
      });
      return () => mm.revert();
    },
    { dependencies: [open], scope: bodyRef }
  );

  const toggleOpen = () => {
    setOpen((current) => {
      const next = !current;
      writeStoredOpen(storageId, next);
      return next;
    });
  };

  return (
    <details className="workspace-artifact" open={open}>
      <summary
        className="workspace-artifact-summary"
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          toggleOpen();
        }}
      >
        <div className="workspace-artifact-heading">
          <h3 className="workspace-artifact-title">{title}</h3>
          {info ? <InfoHint label={info} /> : null}
        </div>
        <CaretDown aria-hidden="true" weight="bold" className="workspace-artifact-caret" />
      </summary>
      <div ref={bodyRef} className="workspace-artifact-body">
        {children}
      </div>
    </details>
  );
}

function readStoredOpen(storageId: string, fallback: boolean): boolean {
  try {
    const stored = window.localStorage.getItem(storageId);
    if (stored === "open") return true;
    if (stored === "closed") return false;
  } catch {
    return fallback;
  }
  return fallback;
}

function writeStoredOpen(storageId: string, open: boolean) {
  try {
    window.localStorage.setItem(storageId, open ? "open" : "closed");
  } catch {
    // Local storage can be unavailable in private or embedded contexts.
  }
}

function slugFromTitle(title: string): string {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
