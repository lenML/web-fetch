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