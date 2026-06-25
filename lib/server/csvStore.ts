import { readFile, rename, writeFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

export async function readCsvRows(pathname: string): Promise<Record<string, string>[]> {
  const content = await readFile(pathname, "utf-8");
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: false
  });
}

export async function readCsvTable(
  pathname: string
): Promise<{ columns: string[]; rows: Record<string, string>[] }> {
  const content = await readFile(pathname, "utf-8");
  return parseCsvTable(content);
}

export async function readCsvTableOrDefault(
  pathname: string,
  defaultColumns: string[]
): Promise<{ columns: string[]; rows: Record<string, string>[] }> {
  const content = await readFile(pathname, "utf-8");
  if (content.trim().length === 0) {
    return { columns: [...defaultColumns], rows: [] };
  }
  const table = parseCsvTable(content);
  return table.columns.length > 0 ? table : { columns: [...defaultColumns], rows: [] };
}

function parseCsvTable(content: string): { columns: string[]; rows: Record<string, string>[] } {
  const header = parse(content, {
    to_line: 1,
    bom: true,
    trim: false
  })[0] as string[] | undefined;
  const columns = header ?? [];
  const rows = parse(content, {
    columns,
    from_line: 2,
    skip_empty_lines: true,
    trim: false
  }) as Record<string, string>[];

  return { columns, rows };
}

export async function writeCsvTableAtomic(
  pathname: string,
  columns: string[],
  rows: Record<string, string>[]
): Promise<void> {
  const content = stringify(rows, {
    header: true,
    columns,
    record_delimiter: "\n"
  });
  const tmpPath = `${pathname}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmpPath, content, "utf-8");
  await rename(tmpPath, pathname);
}
