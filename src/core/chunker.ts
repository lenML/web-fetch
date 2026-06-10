/**
 * Content chunker module.
 * Splits large content into smaller pieces for progressive disclosure.
 */

import { JSDOM } from "jsdom";

/**
 * A single content chunk.
 */
export interface ContentChunk {
  /** Unique key (used as filename) */
  key: string;
  /** Human-readable title */
  title: string;
  /** Text or markdown content */
  content: string;
}

/** Default threshold: 50KB */
const CHUNK_THRESHOLD = 50 * 1024;

/**
 * Whether content is large enough to warrant chunking.
 * @param content - Raw or transformed text content
 * @returns true if content should be chunked
 */
export function should_chunk(content: string): boolean {
  return Buffer.byteLength(content, "utf-8") > CHUNK_THRESHOLD;
}

/**
 * Chunk HTML content by heading elements (h1/h2/h3).
 * Uses innerHTML to preserve formatting in each section.
 * Falls back to a single chunk if no headings found.
 *
 * @param html - Raw HTML string
 * @returns Array of content chunks
 */
export function chunk_html_by_headings(html: string): ContentChunk[] {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const body = doc.body;

  const chunks: ContentChunk[] = [];
  let current_title = "content";
  let current_parts: string[] = [];

  function flush(): void {
    const text = current_parts.join("\n").trim();
    if (text.length === 0) { return; }
    const key = current_title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 60) || "section";
    chunks.push({ key, title: current_title, content: text });
    current_parts = [];
  }

  const children = Array.from(body.childNodes);
  for (const node of children) {
    if (
      node.nodeType === 1 /* ELEMENT_NODE */ &&
      ["H1", "H2", "H3"].includes((node as Element).tagName)
    ) {
      flush();
      current_title = ((node as Element).textContent || "").trim() || "section";
    } else if (node.nodeType === 1 /* ELEMENT_NODE */) {
      // element nodes → use innerHTML to preserve formatting
      const inner = (node as Element).innerHTML;
      if (inner.trim()) { current_parts.push(inner); }
    } else if (node.nodeType === 3 /* TEXT_NODE */) {
      // text nodes → use textContent directly
      const txt = (node as Text).textContent || "";
      if (txt.trim()) { current_parts.push(txt); }
    }
  }
  flush();

  if (chunks.length === 0) {
    return [{ key: "content", title: "content", content: (body.innerHTML || "").trim() }];
  }
  return chunks;
}

/**
 * Chunk JSON content by top-level keys (object) or elements (array).
 * For scalar JSON, returns a single chunk.
 *
 * @param json_str - Raw JSON string
 * @returns Array of content chunks
 */
export function chunk_json_by_keys(json_str: string): ContentChunk[] {
  const parsed: unknown = JSON.parse(json_str);

  if (Array.isArray(parsed)) {
    return parsed.map((item: unknown, idx: number) => ({
      key: `item_${idx}`,
      title: `[${idx}]`,
      content: JSON.stringify(item, null, 2),
    }));
  }

  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    return Object.entries(obj).map(([key, value]) => ({
      key: key,
      title: key,
      content: JSON.stringify(value, null, 2),
    }));
  }

  return [{ key: "value", title: "value", content: JSON.stringify(parsed, null, 2) }];
}