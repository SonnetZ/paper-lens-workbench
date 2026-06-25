import { readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const e2eDataRoot = path.join(os.tmpdir(), "paper-lens-workbench-e2e");
const e2eDbPath = path.join(e2eDataRoot, "reader.sqlite");
const e2eReviewDir = path.join(e2eDataRoot, "review_data");
const e2eMarkdownDir = path.join(e2eDataRoot, "papers_md");
const e2ePdfDir = path.join(e2eDataRoot, "papers_pdf");
const e2eReviewCsvPath = path.join(e2eReviewDir, "full_text_screening.csv");
const e2eReviewMaterialPath = path.join(
  e2eDataRoot,
  "exports",
  "review-materials",
  "FT0001_review_material.md"
);

test.beforeEach(async () => {
  await Promise.all([
    rm(e2eDbPath, { force: true }),
    rm(`${e2eDbPath}-wal`, { force: true }),
    rm(`${e2eDbPath}-shm`, { force: true })
  ]);
});

test("sample reader loads queue and workspace", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();
  await expect(page.getByRole("button", { name: /FT0001 Sample AI-assisted/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Review workspace" })).toBeVisible();
});

test("saves corpus paths from the setup panel and reloads the paper queue", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Corpus setup" }).click();
  await page.getByRole("textbox", { name: "Review data folder" }).fill(e2eReviewDir);
  await page.getByRole("textbox", { name: "Markdown papers folder" }).fill(e2eMarkdownDir);
  await page.getByRole("textbox", { name: "PDF papers folder" }).fill(e2ePdfDir);
  await page.getByRole("button", { name: "Save corpus paths" }).click();

  await expect(page.getByText("Corpus paths saved.")).toBeVisible();
  await expect(page.getByText("1 Markdown files")).toBeVisible();
  await expect(page.getByText("1 records")).toBeVisible();
  await expect(page.getByRole("button", { name: /FT0001 Sample AI-assisted/ })).toBeVisible();
});

test("captures evidence and saves a full-text screening row", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Save selection" }).click();
  await expect(page.getByText("1 evidence item(s) ready.")).toBeVisible();
  await page
    .getByLabel("PDF verification note 1: Abstract")
    .fill("Verified in PDF p. 1; markdown conversion checked.");
  await page.getByRole("button", { name: "Save PDF verification note" }).click();
  await expect(
    page.getByText("PDF verification note: Verified in PDF p. 1; markdown conversion checked.")
  ).toBeVisible();

  const screening = artifactSection(page, "Screening");
  await page.getByLabel("Decision").selectOption("include");
  await screening.getByRole("button", { name: "Attach latest evidence" }).click();
  await page.getByLabel("Reviewer", { exact: true }).fill("YZ");
  await page.getByLabel("Review date").fill("2026-06-23");
  await page.getByRole("button", { name: "Save screening" }).click();

  await expect(page.getByText("Screening saved")).toBeVisible();

  const csv = await readFile(
    e2eReviewCsvPath,
    "utf-8"
  );
  expect(csv).toContain("FT0001,Sample AI-assisted interview analysis");
  expect(csv).toContain("include");
  expect(csv).toContain("YZ,2026-06-23");
});

test("adds a reviewer note as evidence and writes it to screening rationale", async ({ page }) => {
  await page.goto("/");

  await page
    .getByLabel("Reviewer note")
    .fill("Manual judgement: the study evaluates LLM-assisted qualitative analysis.");
  await page.getByLabel("Note locator").fill("Reviewer memo");
  await page.getByRole("button", { name: "Add note as evidence" }).click();
  await expect(page.getByText("1 evidence item(s) ready.")).toBeVisible();

  const screening = artifactSection(page, "Screening");
  await page.getByLabel("Decision").selectOption("include");
  await screening.getByRole("button", { name: "Attach latest evidence" }).click();
  await page.getByLabel("Reviewer", { exact: true }).fill("YZ");
  await page.getByLabel("Review date").fill("2026-06-23");
  await page.getByRole("button", { name: "Save screening" }).click();

  await expect(page.getByText("Screening saved")).toBeVisible();

  const csv = await readFile(
    e2eReviewCsvPath,
    "utf-8"
  );
  expect(csv).toContain("Reviewer memo");
  expect(csv).toContain("Manual judgement: the study evaluates LLM-assisted qualitative analysis.");
});

test("asks a scoped question using reviewer evidence only", async ({ page }) => {
  await page.goto("/");

  await page
    .getByLabel("Reviewer note")
    .fill("Manual judgement: the study evaluates LLM-assisted qualitative analysis.");
  await page.getByLabel("Note locator").fill("Reviewer memo");
  await page.getByRole("button", { name: "Add note as evidence" }).click();

  await page
    .getByLabel("Question")
    .fill("Does this paper evaluate LLM-assisted qualitative analysis?");
  await page.getByRole("button", { name: "Ask with evidence" }).click();

  await expect(page.getByText(/Mock scoped answer/)).toBeVisible();
  await expect(page.getByText("Evidence used")).toBeVisible();
  await expect(page.getByText(/No full paper text was sent to a model/)).toBeVisible();
});

test("reloads saved reviewer evidence from the local evidence store", async ({ page }) => {
  await page.goto("/");

  await page
    .getByLabel("Reviewer note")
    .fill("Reload check: this evidence should survive a browser refresh.");
  await page.getByLabel("Note locator").fill("Reload memo");
  await page.getByRole("button", { name: "Add note as evidence" }).click();
  await expect(page.getByText("Reload memo", { exact: true })).toBeVisible();

  await page.reload();

  await expect(page.getByText("Reload memo", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Reload check: this evidence should survive a browser refresh.")
  ).toBeVisible();
});

test("saves and reloads extraction notes with attached evidence", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Save selection" }).click();
  await expect(page.getByText("1 evidence item(s) ready.")).toBeVisible();

  const extraction = artifactSection(page, "Extraction");
  await extraction
    .getByLabel("Method typology")
    .fill("Analytical pathway: human-in-the-loop LLM coding.");
  await extraction.getByLabel("Attach evidence to").selectOption("evaluationPractices");
  await extraction.getByRole("button", { name: "Attach latest evidence" }).click();
  await extraction.getByLabel("Synthesis note").fill("Keep for methodological typology.");
  await extraction.getByRole("button", { name: "Save extraction" }).click();

  await expect(extraction.getByText("Extraction saved")).toBeVisible();

  await page.reload();

  const reloadedExtraction = artifactSection(page, "Extraction");
  await expect(
    reloadedExtraction.getByLabel("Method typology")
  ).toHaveValue("Analytical pathway: human-in-the-loop LLM coding.");
  await expect(reloadedExtraction.getByLabel("Evaluation practices")).toHaveValue(
    /This synthetic paper is included only to test the reader/
  );
  await expect(reloadedExtraction.getByLabel("Synthesis note")).toHaveValue(
    "Keep for methodological typology."
  );
});

test("routes captured evidence from the tray into an extraction field", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Save selection" }).click();
  await expect(page.getByText("1 evidence item(s) ready.")).toBeVisible();

  await page
    .getByLabel("Target field 1: Abstract")
    .selectOption("extraction.evaluationPractices");
  await page.getByRole("button", { name: "Send evidence to field" }).click();

  const extraction = artifactSection(page, "Extraction");
  await expect(extraction.getByLabel("Evaluation practices")).toHaveValue(
    /Abstract: This synthetic paper is included only to test the reader/
  );
  await expect(extraction.getByLabel("Extraction evidence locator")).toHaveValue("Abstract");

  await extraction.getByRole("button", { name: "Save extraction" }).click();
  await expect(extraction.getByText("Extraction saved")).toBeVisible();

  await page.reload();

  const reloadedExtraction = artifactSection(page, "Extraction");
  await expect(reloadedExtraction.getByLabel("Evaluation practices")).toHaveValue(
    /Abstract: This synthetic paper is included only to test the reader/
  );
});

test("exports a review material packet with evidence, screening, and extraction notes", async ({
  page
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Save selection" }).click();
  await expect(page.getByText("1 evidence item(s) ready.")).toBeVisible();
  await page
    .getByLabel("PDF verification note 1: Abstract")
    .fill("Verified in PDF p. 1; markdown conversion checked.");
  await page.getByRole("button", { name: "Save PDF verification note" }).click();
  await expect(
    page.getByText("PDF verification note: Verified in PDF p. 1; markdown conversion checked.")
  ).toBeVisible();

  const screening = artifactSection(page, "Screening");
  await page.getByLabel("Decision").selectOption("include");
  await screening.getByRole("button", { name: "Attach latest evidence" }).click();
  await page.getByLabel("Reviewer", { exact: true }).fill("YZ");
  await page.getByLabel("Review date").fill("2026-06-23");
  await page.getByRole("button", { name: "Save screening" }).click();
  await expect(screening.getByText("Screening saved")).toBeVisible();

  const extraction = artifactSection(page, "Extraction");
  await extraction
    .getByLabel("Method typology")
    .fill("Analytical pathway: human-in-the-loop LLM coding.");
  await extraction.getByLabel("Attach evidence to").selectOption("evaluationPractices");
  await extraction.getByRole("button", { name: "Attach latest evidence" }).click();
  await extraction.getByLabel("Synthesis note").fill("Ready for review synthesis.");
  await extraction.getByRole("button", { name: "Save extraction" }).click();
  await expect(extraction.getByText("Extraction saved")).toBeVisible();

  const reviewMaterial = artifactSection(page, "Review material");
  await reviewMaterial.getByRole("button", { name: "Export review material" }).click();
  await expect(reviewMaterial.getByText("Exported 1 evidence item(s).")).toBeVisible();
  await expect(reviewMaterial.getByText(e2eReviewMaterialPath)).toBeVisible();

  const markdown = await readFile(e2eReviewMaterialPath, "utf-8");
  expect(markdown).toContain("# FT0001 - Sample AI-assisted interview analysis");
  expect(markdown).toContain("- Decision: include");
  expect(markdown).toContain("Analytical pathway: human-in-the-loop LLM coding.");
  expect(markdown).toContain("Ready for review synthesis.");
  expect(markdown).toContain("## Evidence Chain");
  expect(markdown).toContain("> This synthetic paper is included only to test the reader.");
  expect(markdown).toContain(
    "- PDF verification note: Verified in PDF p. 1; markdown conversion checked."
  );
});

function artifactSection(page: Page, title: string) {
  return page.locator("section", {
    has: page.locator("> h3", { hasText: new RegExp(`^${escapeRegExp(title)}$`) })
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
