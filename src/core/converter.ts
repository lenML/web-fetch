/**
 * Content converter module.
 * Converts raw body content between formats (HTML→Markdown, JSON→pretty, etc).
 */

import { JSDOM } from "jsdom";
import TurndownService from "turndown";

const turndown_service = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

/**
 * Convert HTML string to Markdown.
 * Uses Turndown under the hood for robust HTML→MD conversion.
 *
 * @param html - Raw HTML string
 * @returns Markdown string
 */
export function convert_html_to_markdown(html: string): string {
  if (html === "") {
    return "";
  }

  const dom = new JSDOM(html);
  const document = dom.window.document;
  const body = document.body;

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
  const parsed = JSON.parse(json);
  return JSON.stringify(parsed, null, 2);
}