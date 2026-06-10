/**
 * Content converter module.
 * Converts raw body content between formats (HTML→Markdown, JSON→pretty, etc).
 */

import TurndownService from "turndown";

/* eslint-disable @typescript-eslint/naming-convention */
const turndown_service = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Convert HTML string to Markdown.
 * Uses Turndown under the hood for robust HTML→MD conversion.
 *
 * @param html - Raw HTML string
 * @returns Markdown string
 */
export function convert_html_to_markdown(html: string): string {
  if (html === "") { return ""; }
  return turndown_service.turndown(html);
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