/**
 * Content transformer module.
 * Auto-detects content type, applies conversion, and optionally
 * chunks + saves to temp store for progressive disclosure.
 *
 * Returns structured data (not formatted strings) — rendering is CLI's job.
 */

import { ContentType, detect_content_type } from "./detector.js";
import { convert_html_to_markdown, convert_json_to_toon } from "./converter.js";
import { should_chunk, chunk_html_by_headings, chunk_json_by_keys } from "./chunker.js";
import type { ContentChunk } from "./chunker.js";
import { TempStore } from "./temp_store.js";
import type { ResolvedFetch } from "./temp_store.js";

/** Shared temp store instance. */
const temp_store = new TempStore();

export { TempStore } from "./temp_store.js";
export type { ResolvedFetch, SavedChunk } from "./temp_store.js";

/**
 * Result of a content transformation.
 */
export interface TransformResult {
  /** Human-readable output type label (e.g. "markdown", "json", "text") */
  type: string;
  /** Transformed content (inline) or empty string when chunked */
  data: string;
  /** If true, data is the full inline content; otherwise saved to temp store */
  inline: boolean;
  /** Chunks from temp store (only set when inline=false) */
  chunks: ContentChunk[];
  /** Resolved fetch record if saved to temp store */
  fetch_record?: ResolvedFetch;
}

/**
 * Auto-detect content type from Content-Type header and transform raw body.
 * Large content is chunked and saved to temp store for progressive disclosure.
 *
 * @param body - Raw response body string
 * @param content_type_header - HTTP Content-Type header value
 * @param source_url - Original URL being fetched (for cache metadata)
 * @returns TransformResult — inline data or structured chunk references
 */
export function transform_content(
  body: string,
  content_type_header: string | undefined,
  source_url?: string,
): TransformResult {
  const content_type = detect_content_type(content_type_header);
  const url = source_url ?? "(unknown)";

  switch (content_type) {
    case ContentType.html: {
      const md = convert_html_to_markdown(body);
      if (!should_chunk(md)) {
        return { type: "markdown", data: md, inline: true, chunks: [] };
      }

      const raw_chunks = chunk_html_by_headings(body);
      const chunks_for_save = raw_chunks.map((c: ContentChunk) => ({
        key: c.key,
        title: c.title,
        content: convert_html_to_markdown(c.content),
      }));

      const record = temp_store.save_fetch({
        url,
        content_type: "text/html",
        chunks: chunks_for_save,
      });

      const resolved = temp_store.resolve_fetch(record.id);
      if (resolved == null) { throw new Error("failed to resolve fetch"); }
      return {
        type: "markdown",
        data: "",
        inline: false,
        chunks: chunks_for_save,
        fetch_record: resolved,
      };
    }

    case ContentType.json: {
      if (!should_chunk(body)) {
        return { type: "json", data: convert_json_to_toon(body), inline: true, chunks: [] };
      }

      const raw_chunks = chunk_json_by_keys(body);
      const chunks_for_save = raw_chunks.map((c: ContentChunk) => ({
        key: c.key,
        title: c.title,
        content: c.content,
      }));

      const record = temp_store.save_fetch({
        url,
        content_type: "application/json",
        chunks: chunks_for_save,
      });

      const resolved = temp_store.resolve_fetch(record.id);
      if (resolved == null) { throw new Error("failed to resolve fetch"); }
      return {
        type: "json",
        data: "",
        inline: false,
        chunks: chunks_for_save,
        fetch_record: resolved,
      };
    }

    case ContentType.pdf: {
      return { type: "pdf", data: body, inline: true, chunks: [] };
    }

    default: {
      if (!should_chunk(body)) {
        return { type: "text", data: body, inline: true, chunks: [] };
      }

      const chunks_for_save = [{ key: "content", title: "content", content: body }];
      const record = temp_store.save_fetch({
        url,
        content_type: "text/plain",
        chunks: chunks_for_save,
      });

      const resolved = temp_store.resolve_fetch(record.id);
      if (resolved == null) { throw new Error("failed to resolve fetch"); }
      return {
        type: "text",
        data: "",
        inline: false,
        chunks: chunks_for_save,
        fetch_record: resolved,
      };
    }
  }
}