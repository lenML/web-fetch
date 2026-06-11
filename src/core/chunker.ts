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

/** Minimum content length (chars) for a standalone chunk. Smaller adjacent chunks merge into previous. */
const MIN_CHUNK_SIZE = 1000;

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

/**
 * Merge adjacent chunks that are smaller than MIN_CHUNK_SIZE.
 * Ensures no chunk is trivially tiny (reduces noise from partial lines / table cells).
 */
function merge_small_chunks(chunks: ContentChunk[]): ContentChunk[] {
  if (chunks.length <= 1) { return chunks; }

  const result: ContentChunk[] = [];

  for (const chunk of chunks) {
    if (result.length === 0) {
      result.push(chunk);
    } else {
      const last = result[result.length - 1];
      if (last.content.length < MIN_CHUNK_SIZE || chunk.content.length < MIN_CHUNK_SIZE) {
        result[result.length - 1] = {
          key: last.key,
          title: last.title,
          content: last.content + "\n\n" + chunk.content,
        };
      } else {
        result.push(chunk);
      }
    }
  }

  return result;
}

/**
 * Chunk plain text by detected headings.
 * Splits on lines that look like headings:
 *   - Numbered: "1.", "1.1", "Section 2", "Chapter 3"
 *   - All-caps short lines
 *   - Lines ending with colon
 * Falls back to paragraph-level split if no headings found.
 *
 * @param text - Plain text content (e.g. extracted from PDF)
 * @returns Array of content chunks
 */
export function chunk_text_by_headings(text: string): ContentChunk[] {
  const lines = text.split("\n");
  const chunks: ContentChunk[] = [];
  let current_title = "introduction";
  let current_parts: string[] = [];

  function is_heading(line: string): boolean {
    const trimmed = line.trim();

    // Empty or too short
    if (trimmed.length < 2) { return false; }
    if (trimmed.length > 120) { return false; }

    // Numbered: "1. ...", "1.1 ...", "1.1.1 ..."
    if (/^\d+(\.\d+)*\.?\s+/.test(trimmed)) { return true; }

    // "Chapter X", "Section X", "Part X"
    if (/^(chapter|section|part|appendix)\s+\d+/i.test(trimmed)) { return true; }

    // All-caps short line
    if (trimmed === trimmed.toUpperCase() && trimmed.length > 3) { return true; }

    // "Abstract", "Introduction", "Conclusion", "References" etc
    if (/^(abstract|introduction|background|method|result|discussion|conclusion|references|acknowledgment)/i.test(trimmed)) {
      return true;
    }

    return false;
  }

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

  for (const line of lines) {
    if (is_heading(line)) {
      flush();
      current_title = line.trim();
    } else {
      if (line.trim()) { current_parts.push(line); }
    }
  }
  flush();

  if (chunks.length === 0) {
    // Fallback: split by double newlines into paragraphs
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
    return paragraphs.map((p, i) => ({
      key: `para_${i}`,
      title: `paragraph ${i + 1}`,
      content: p.trim(),
    }));
  }

  return merge_small_chunks(chunks);
}
