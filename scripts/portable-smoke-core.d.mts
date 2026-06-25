export interface PortableSmokeStep {
  name:
    | "source-portability-check"
    | "archive-pack"
    | "archive-extract"
    | "unpacked-portability-check";
  ok: boolean;
}

export interface PortableSmokeIssue {
  code: string;
  relativePath: string;
  message: string;
}

export interface PortableSmokeReport {
  ok: boolean;
  archiveName: string;
  archivePath: string;
  unpackedAppRoot: string;
  steps: PortableSmokeStep[];
  issues: PortableSmokeIssue[];
}

export function runPortableSmokeCheck(
  appRoot: string,
  options?: { keepTemp?: boolean }
): PortableSmokeReport;
