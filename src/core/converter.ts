/**
 * Content converter module.
 * Converts raw body content between formats (HTML→Markdown, JSON→pretty, etc).
 */

import { JSDOM } from "jsdom";
import TurndownService from "turndown";

/* eslint-disable @typescript-eslint/naming-convention */
const turndown_service = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Convert HTML string to Markdown.
 * Extracts <body> first to exclude head/style/script noise.
 * Uses Turndown under the hood for robust HTML→MD conversion.
 *
 * @param html - Raw HTML string
 * @returns Markdown string
 */
export function convert_html_to_markdown(html: string): string {
  if (html === "") { return ""; }

  // Extract body content to exclude <style>/<script>/<head> from output
  const dom = new JSDOM(html);
  const body = dom.window.document.body;

  return turndown_service.turndown(body);
}

/**
 * Pretty-print JSON string (2-space indent).
 * Throws on invalid JSON.
 *
 * @param json - Raw JSON string
 * @returns Formatted JSON string
 */
export function convert_json_to_toon(json: string): string {
  const parsed: unknown = JSON.parse(json);
  return JSON.stringify(parsed, null, 2);
}
/**
 * Parse CSV text into rows.
 * Handles quoted fields with escaped quotes and commas inside quotes.
 */
function parse_csv(text: string): string[][] {
  const rows: string[][] = [];
  let cur_row: string[] = [];
  let cur_field = "";
  let in_q = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (in_q) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') { cur_field += '"'; i += 2; continue; }
        in_q = false;
      } else { cur_field += ch; }
      i++;
      continue;
    }
    if (ch === '"') { in_q = true; i++; continue; }
    if (ch === ",") { cur_row.push(cur_field); cur_field = ""; i++; continue; }
    if (ch === "\r") { i++; continue; }
    if (ch === "\n") {
      cur_row.push(cur_field); cur_field = "";
      if (cur_row.length > 0) { rows.push(cur_row); }
      cur_row = []; i++;
      continue;
    }
    cur_field += ch; i++;
  }
  if (cur_field !== "" || cur_row.length > 0) {
    cur_row.push(cur_field);
    if (cur_row.length > 0) { rows.push(cur_row); }
  }
  return rows;
}

/**
 * Convert CSV string to markdown table.
 * First row is treated as header.
 *
 * @param csv - Raw CSV string
 * @returns Markdown table string
 */
export function convert_csv_to_markdown(csv: string): string {
  const trimmed = csv.trim();
  if (trimmed === "") { return ""; }
  const rows = parse_csv(trimmed);
  if (rows.length === 0) { return ""; }

  const max_cols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const pad = (r: string[]): string[] => r.concat(Array.from({ length: max_cols - r.length }, () => ""));

  const out: string[] = [];
  out.push(`| ${pad(rows[0]).join(" | ")} |`);
  out.push(`| ${rows[0].map(() => "---").join(" | ")} |`);
  for (let i = 1; i < rows.length; i++) {
    out.push(`| ${pad(rows[i]).join(" | ")} |`);
  }
  return out.join("\n");
}
