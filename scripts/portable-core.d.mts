export interface PortableIssue {
  code: "MISSING_REQUIRED_FILE" | "MISSING_PACKAGE_SCRIPT" | "HOST_PATH_LEAK";
  relativePath: string;
  message: string;
}

export interface PortableBoxReport {
  ok: boolean;
  issues: PortableIssue[];
  summary: {
    appRoot: string;
    requiredFilesChecked: number;
    packageScriptsChecked: number;
    scannedFiles: number;
  };
}

export interface PortableFileListOptions {
  scannableOnly?: boolean;
}

export const requiredFiles: string[];
export const requiredPackageScripts: string[];

export function parseFlags(argv: string[]): {
  json: boolean;
  dryRun: boolean;
};

export function buildPortableBoxReport(appRoot: string): PortableBoxReport;

export function listPortableFiles(
  appRoot: string,
  options?: PortableFileListOptions
): string[];

export function getArchiveName(appRoot: string): string;
