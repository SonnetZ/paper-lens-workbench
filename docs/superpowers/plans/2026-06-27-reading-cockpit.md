# Reading Cockpit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first complete reading cockpit pass for Paper Lens.

**Architecture:** Keep the existing Next.js and Tailwind structure. Add cockpit telemetry to the reader surface, replace right-side group stacking with task modes, and refine evidence/queue styling without changing data contracts.

**Tech Stack:** Next.js, React client components, Tailwind classes, existing Phosphor icons, Vitest + Testing Library.

---

### Task 1: Reader Cockpit Bar

**Files:**
- Modify: `components/AppShell.tsx`
- Modify: `components/ReaderShell.tsx`
- Test: `tests/client/AppShell.test.tsx`

- [x] Add props to `ReaderShell` for `evidenceCount` and `knowledgeBaseId`.
- [x] Render an `aria-label="Reading cockpit"` toolbar with record id, source chips, evidence count, model mode, and knowledge base id.
- [x] Update AppShell tests to assert cockpit telemetry.

### Task 2: Workspace Task Modes

**Files:**
- Modify: `components/ReviewWorkspace.tsx`
- Test: `tests/client/ReviewWorkspace.test.tsx`

- [x] Replace persistent Model/AI help/Corpus/Human record groups with `Assist`, `Evidence`, and `Review` task-mode tabs.
- [x] Render only the active mode's tools.
- [x] Keep existing tool components and storage keys.
- [x] Update tests to switch modes and verify visible tools.

### Task 3: Cockpit Visual System

**Files:**
- Modify: `app/globals.css`
- Modify: `components/PaperQueue.tsx`
- Modify: `components/EvidenceTray.tsx`

- [x] Add cockpit shell, telemetry, workspace mode, queue index, and evidence stack styles.
- [x] Keep cards only for repeated evidence items.
- [x] Preserve mobile stacking and collapse controls.

### Task 4: Verification

**Commands:**
- `./node_modules/.bin/tsc --noEmit`
- `./node_modules/.bin/vitest run --reporter verbose`
- `npm run build`
- `git diff --check`

**Latest local verification:** `git diff --check`, `./node_modules/.bin/tsc --noEmit`, `./node_modules/.bin/vitest run`, and `npm run build` pass. Browser screenshot verification is still pending because this environment cannot bind a local dev-server port and Playwright browsers are not installed.
