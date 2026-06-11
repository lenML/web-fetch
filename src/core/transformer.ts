/**
 * Content transformer module.
 * Auto-detects content type, applies conversion, and optionally
 * chunks + saves to temp store for progressive disclosure.
 *
 * Returns structured data (not formatted strings) — rendering is CLI's job.
 */

import { ContentType, detect_content_type } from "./detector.js";
import { convert_html_to_markdown, convert_json_to_toon, convert_csv_to_markdown } from "./converter.js";
import { should_chunk, chunk_html_by_headings, chunk_json_by_keys, chunk_text_by_headings, chunk_csv_by_row_groups, chunk_zip_contents } from "./chunker.js";
import type { ContentChunk } from "./chunker.js";
import { TempStore } from "./temp_store.js";
import type { ResolvedFetch } from "./temp_store.js";

export { TempStore } from "./temp_store.js";
export type { ResolvedFetch, SavedChunk } from "./temp_store.js";

/**
 * Result of a content transformation.
 */
export interface TransformResult {
  /** Human-readable output type label */
  type: string;
  /** Transformed content (inline) or empty string when chunked */
  data: string;
  /** If true, data is the full inline content; otherwise saved to temp store */
  inline: boolean;
  /** Chunks from temp store (only set when inline=false) */
  chunks: ContentChunk[];
  /** Resolved fetch record if saved to temp store */
  fetch_record?: ResolvedFetch;
  /** Original binary file path (e.g. for PDFs) */
  original_path?: string;
}

/** Check if Content-Type indicates binary data. */
function is_binary_content_type(content_type: string | undefined): boolean {
  if (content_type == null) { return false; }
  const lower = content_type.toLowerCase();
  return lower.includes("application/pdf")
    || lower.includes("application/octet-stream")
    || lower.includes("image/")
    || lower.includes("audio/")
    || lower.includes("video/");
}

/**
 * Auto-detect content type from Content-Type header and transform raw body.
 * Large content is chunked and saved to temp store for progressive disclosure.
 * PDF content is extracted to text, chunked by headings, and the original file is preserved.
 *
 * @param body - Raw response body (Buffer for binary, or string for pre-decoded text)
 * @param content_type_header - HTTP Content-Type header value
 * @param source_url - Original URL being fetched (for cache metadata)
 * @param use_global_cache - Use global temp dir instead of local .fetch-cache
 * @returns TransformResult — inline data or structured chunk references
 */
export async function transform_content(
  body: Buffer | string,
  content_type_header: string | undefined,
  source_url?: string,
  use_global_cache?: boolean,
): Promise<TransformResult> {
  const content_type = detect_content_type(content_type_header, source_url);
  const url = source_url ?? "(unknown)";
  const text = typeof body === "string" ? body : body.toString("utf-8");

  switch (content_type) {
    case ContentType.html: {
      const md = convert_html_to_markdown(text);
      if (!should_chunk(md)) {
        return { type: "markdown", data: md, inline: true, chunks: [] };
      }

      const raw_chunks = chunk_html_by_headings(text);
      const chunks_for_save = raw_chunks.map((c: ContentChunk) => ({
        key: c.key,
        title: c.title,
        content: convert_html_to_markdown(c.content),
      }));

      const store_local = new TempStore({ use_global_cache });
      const record = store_local.save_fetch({ url, content_type: "text/html", chunks: chunks_for_save });
      const resolved = store_local.resolve_fetch(record.id);
      if (resolved == null) { throw new Error("failed to resolve fetch"); }
      return { type: "markdown", data: "", inline: false, chunks: chunks_for_save, fetch_record: resolved };
    }

    case ContentType.json: {
      if (!should_chunk(text)) {
        return { type: "json", data: convert_json_to_toon(text), inline: true, chunks: [] };
      }

      const raw_chunks = chunk_json_by_keys(text);
      const chunks_for_save = raw_chunks.map((c: ContentChunk) => ({ key: c.key, title: c.title, content: c.content }));
      const store_local = new TempStore({ use_global_cache });
      const record = store_local.save_fetch({ url, content_type: "application/json", chunks: chunks_for_save });
      const resolved = store_local.resolve_fetch(record.id);
      if (resolved == null) { throw new Error("failed to resolve fetch"); }
      return { type: "json", data: "", inline: false, chunks: chunks_for_save, fetch_record: resolved };
    }

    case ContentType.pdf: {
      const raw_body = typeof body === "string" ? Buffer.from(body, "utf-8") : body;
      const store_local = new TempStore({ use_global_cache });

      // 1. Save original PDF
      const pdf_record = store_local.save_fetch({
        url, content_type: "application/pdf",
        chunks: [{ key: "document", title: "original pdf", content: raw_body, filename: "document.pdf" }],
      });
      const original_path = pdf_record.chunks[0].path;

      // 2. Extract text from PDF
      let pdf_text: string;
      try {
        const { PDFParse: pdf_parse_class } = await import("pdf-parse");
        const parser = new pdf_parse_class({ data: raw_body });
        const text_result = await parser.getText();
        pdf_text = text_result.text;
        await parser.destroy();
      } catch {
        // Fallback: just reference the raw PDF
        return {
          type: "pdf", data: "", inline: false,
          chunks: [{ key: "document", title: "original pdf", content: "PDF text extraction failed" }],
          fetch_record: store_local.resolve_fetch(pdf_record.id) ?? undefined,
          original_path,
        };
      }

      if (pdf_text.trim().length === 0) {
        return {
          type: "pdf", data: "", inline: false,
          chunks: [{ key: "document", title: "original pdf", content: "PDF contains no extractable text" }],
          fetch_record: store_local.resolve_fetch(pdf_record.id) ?? undefined,
          original_path,
        };
      }

      // 3. Chunk extracted text by headings
      const text_chunks = chunk_text_by_headings(pdf_text);
      const chunks_for_save = text_chunks.map((c: ContentChunk, idx: number) => ({
        key: c.key,
        title: c.title,
        content: c.content,
        filename: `section_${String(idx).padStart(2, "0")}.md`,
      }));

      // Save text chunks in a separate fetch entry
      const text_record = store_local.save_fetch({
        url: `pdf:text:${url}`,
        content_type: "text/markdown",
        chunks: chunks_for_save,
      });

      const resolved = store_local.resolve_fetch(text_record.id);
      if (resolved == null) { throw new Error("failed to resolve fetch"); }
      return {
        type: "pdf",
        data: "",
        inline: false,
        chunks: chunks_for_save,
        fetch_record: resolved,
        original_path,
      };
    }


    case ContentType.csv: {
      const md = convert_csv_to_markdown(text);
      // parse csv for chunking
      const csv_rows: string[][] = ((): string[][] => {
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
            i++; continue;
          }
          if (ch === '"') { in_q = true; i++; continue; }
          if (ch === ",") { cur_row.push(cur_field); cur_field = ""; i++; continue; }
          if (ch === "\r") { i++; continue; }
          if (ch === "\n") {
            cur_row.push(cur_field); cur_field = "";
            if (cur_row.length > 0) { rows.push(cur_row); }
            cur_row = []; i++; continue;
          }
          cur_field += ch; i++;
        }
        if (cur_field !== "" || cur_row.length > 0) { cur_row.push(cur_field); if (cur_row.length > 0) { rows.push(cur_row); } }
        return rows;
      })();

      const csv_chunks = chunk_csv_by_row_groups(csv_rows);
      if (csv_chunks.length === 0) {
        return { type: "csv", data: md, inline: true, chunks: [] };
      }

      const chunks_for_save = csv_chunks.map((c) => ({ key: c.key, title: c.title, content: c.content }));
      const store_local = new TempStore({ use_global_cache });
      const record = store_local.save_fetch({ url, content_type: "text/csv", chunks: chunks_for_save });
      const resolved = store_local.resolve_fetch(record.id);
      if (resolved == null) { throw new Error("failed to resolve fetch"); }
      return { type: "csv", data: "", inline: false, chunks: csv_chunks, fetch_record: resolved };
    }

    case ContentType.zip: {
      const raw_body = typeof body === "string" ? Buffer.from(body, "utf-8") : body;
      const store_local = new TempStore({ use_global_cache });

      // save original archive
      const zip_record = store_local.save_fetch({
        url, content_type: "application/zip",
        chunks: [{ key: "archive", title: "original archive", content: raw_body, filename: "archive.zip" }],
      });
      const original_path = zip_record.chunks[0].path;

      // extract contents
      const zip_chunks = await chunk_zip_contents(raw_body);
      if (zip_chunks.length === 1 && zip_chunks[0].key === "error") {
        return {
          type: "zip", data: "", inline: false, chunks: zip_chunks,
          fetch_record: store_local.resolve_fetch(zip_record.id) ?? undefined, original_path,
        };
      }

      const chunks_for_save = zip_chunks.map((c) => ({ key: c.key, title: c.title, content: c.content }));
      const text_record = store_local.save_fetch({
        url: `zip:contents:${url}`,
        content_type: "text/plain",
        chunks: chunks_for_save,
      });

      const resolved = store_local.resolve_fetch(text_record.id);
      if (resolved == null) { throw new Error("failed to resolve fetch"); }
      return { type: "zip", data: "", inline: false, chunks: zip_chunks, fetch_record: resolved, original_path };
    }
    default: {
      if (is_binary_content_type(content_type_header)) {
        const raw_body = typeof body === "string" ? Buffer.from(body, "utf-8") : body;
        const store_local = new TempStore({ use_global_cache });
        const record = store_local.save_fetch({
          url, content_type: content_type_header ?? "application/octet-stream",
          chunks: [{ key: "file", title: "file", content: raw_body, filename: "file.bin" }],
        });
        const resolved = store_local.resolve_fetch(record.id);
        if (resolved == null) { throw new Error("failed to resolve fetch"); }
        return { type: "binary", data: "", inline: false, chunks: [], fetch_record: resolved };
      }

      if (!should_chunk(text)) {
        return { type: "text", data: text, inline: true, chunks: [] };
      }

      const chunks_for_save = [{ key: "content", title: "content", content: text }];
      const store_local = new TempStore({ use_global_cache });
      const record = store_local.save_fetch({ url, content_type: "text/plain", chunks: chunks_for_save });
      const resolved = store_local.resolve_fetch(record.id);
      if (resolved == null) { throw new Error("failed to resolve fetch"); }
      return { type: "text", data: "", inline: false, chunks: chunks_for_save, fetch_record: resolved };
    }
  }
}