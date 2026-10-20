export const WAITLIST_SOURCES = [
  "oct27",
  "ig",
  "dm",
  "slack",
  "familcy",
  "sponsor",
  "nuance",
  "manifest",
] as const;

export type WaitlistSource = (typeof WAITLIST_SOURCES)[number] | "direct";

const SOURCE_SET = new Set<string>(WAITLIST_SOURCES);

/** Anything outside the allow-list is stored as direct. */
export function normalizeWaitlistSrc(value: string | null | undefined): WaitlistSource {
  const cleaned = (value ?? "").trim().toLowerCase();
  if (SOURCE_SET.has(cleaned)) return cleaned as WaitlistSource;
  return "direct";
}

export function waitlistInvitePath(refCode: string): string {
  return `/waitlist?ref=${encodeURIComponent(refCode)}`;
}

export function founderInvitePath(token: string): string {
  return `/auth?invite=${encodeURIComponent(token)}`;
}

export function csvCell(value: string | null | undefined): string {
  const text = value ?? "";
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export type WaitlistImportRow = { name: string; email: string; ig: string | null };

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

/** Header row must include name and email. IG is optional (ig, ig_handle, or instagram). */
export function parseWaitlistImportCsv(text: string): { rows: WaitlistImportRow[]; error?: string } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length < 2) return { rows: [], error: "CSV needs a header and one row." };
  const header = splitCsvLine(lines[0]).map((cell) => cell.trim().toLowerCase());
  const nameIdx = header.indexOf("name");
  const emailIdx = header.indexOf("email");
  const igIdx = header.findIndex((cell) => cell === "ig" || cell === "ig_handle" || cell === "instagram");
  if (nameIdx < 0 || emailIdx < 0) return { rows: [], error: "CSV needs name and email columns." };
  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const ig = igIdx >= 0 ? cells[igIdx]?.trim() ?? "" : "";
    return {
      name: cells[nameIdx]?.trim() ?? "",
      email: cells[emailIdx]?.trim() ?? "",
      ig: ig || null,
    };
  });
  return { rows };
}
