/**
 * Temp file storage module.
 * Manages fetch results as temp files with auto-cleanup.
 *
 * Expiry policy:
 *   - >1 day: stale (file exists but content is considered expired)
 *   - >30 days: deleted on next cleanup()
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync, statSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { cwd } from "process";
import { randomBytes } from "crypto";

/**
 * A single chunk of fetched content saved to disk.
 */
export interface SavedChunk {
  /** Unique key within the fetch (e.g. "01_introduction") */
  key: string;
  /** Human-readable title */
  title: string;
  /** Absolute path to the saved file */
  path: string;
  /** Content size in bytes */
  size: number;
  /** Creation timestamp (ms) */
  created_at: number;
  /** Expiry timestamp (ms) — after this, content is stale */
  expires_at: number;
}

/**
 * Status of a resolved fetch record.
 */
export type ResolveStatus = "fresh" | "stale";

/**
 * Resolved fetch record from temp store.
 */
export interface ResolvedFetch {
  /** Fetch record ID */
  id: string;
  /** Original URL */
  url: string;
  /** Detected content type */
  content_type: string;
  /** When the fetch was made */
  fetched_at: number;
  /** Resolution status */
  status: ResolveStatus;
  /** Saved chunks */
  chunks: SavedChunk[];
}

/**
 * Input for saving a new fetch record.
 */
export interface SaveFetchInput {
  /** Original URL */
  url: string;
  /** Detected content type */
  content_type: string;
  /** Chunks to save */
  chunks: {
    key: string;
    title: string;
    content: string | Buffer;
    /** Override filename (e.g. "document.pdf") — default: {key}.md */
    filename?: string;
  }[];
}

/**
 * Internal persisted metadata structure.
 */
interface FetchRecordMeta {
  id: string;
  url: string;
  content_type: string;
  fetched_at: number;
  chunks: SavedChunk[];
}

const STALE_AFTER_MS = 86400 * 1000;      // 1 day
const DELETE_AFTER_MS = 30 * 86400 * 1000; // 30 days

function generate_id(): string {
  return randomBytes(8).toString("hex");
}

function ensure_dir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * TempStore manages fetch results cached on local disk.
 * Each fetch creates a subdirectory under base_dir with:
 *   index.json  - metadata describing all chunks
 *   <key>.md    - actual chunk content files
 */
export class TempStore {
  private readonly base_dir: string;

  /** Local cache dir inside the project cwd */
  static readonly local_base = join(cwd(), ".fetch-cache");
  /** Global cache dir in OS temp */
  static readonly global_base = join(tmpdir(), "web-fetch-cache");

  constructor(options?: { base_dir?: string; use_global_cache?: boolean }) {
    if (options?.use_global_cache) {
      this.base_dir = options.base_dir ?? TempStore.global_base;
    } else {
      this.base_dir = options?.base_dir ?? TempStore.local_base;
    }
    ensure_dir(this.base_dir);
  }

  /**
   * Save a fetch result as chunk files + index metadata.
   * @param input - Fetch data to persist
   * @returns The saved record metadata
   */
  save_fetch(input: SaveFetchInput): FetchRecordMeta {
    const id = generate_id();
    const dir = join(this.base_dir, id);
    ensure_dir(dir);

    const now = Date.now();
    const fetched_at = now;
    const saved_chunks: SavedChunk[] = [];

    for (const chunk of input.chunks) {
      const filename = chunk.filename ?? `${chunk.key}.md`;
      const filepath = join(dir, filename);
      writeFileSync(filepath, chunk.content, "utf-8");

      saved_chunks.push({
        key: chunk.key,
        title: chunk.title,
        path: filepath,
        size: Buffer.byteLength(chunk.content, "utf-8"),
        created_at: now,
        expires_at: now + STALE_AFTER_MS,
      });
    }

    const record: FetchRecordMeta = {
      id,
      url: input.url,
      content_type: input.content_type,
      fetched_at,
      chunks: saved_chunks,
    };

    writeFileSync(join(dir, "index.json"), JSON.stringify(record, null, 2), "utf-8");
    return record;
  }

  /**
   * List all cached fetch records (recent first).
   * @returns Array of fetch IDs with basic info
   */
  list_fetches(): { id: string; url: string; fetched_at: number; status: ResolveStatus }[] {
    const results: { id: string; url: string; fetched_at: number; status: ResolveStatus }[] = [];
    let entries: string[];
    try {
      entries = readdirSync(this.base_dir);
    } catch {
      return results;
    }

    const now = Date.now();
    for (const entry of entries) {
      const dir = join(this.base_dir, entry);
      const meta_path = join(dir, "index.json");
      if (!existsSync(meta_path)) { continue; }

      try {
        const meta = JSON.parse(readFileSync(meta_path, "utf-8")) as FetchRecordMeta;
        const age = now - meta.fetched_at;
        if (age > DELETE_AFTER_MS) {
          rmSync(dir, { recursive: true, force: true });
          continue;
        }
        results.push({
          id: meta.id,
          url: meta.url,
          fetched_at: meta.fetched_at,
          status: age > STALE_AFTER_MS ? "stale" : "fresh",
        });
      } catch {
        continue;
      }
    }

    results.sort((a, b) => b.fetched_at - a.fetched_at);
    return results;
  }

  /**
   * Resolve a fetch record by ID.
   * Returns null if the record is deleted or doesn't exist.
   * Records older than 1 day are marked as stale.
   *
   * @param id - Fetch record ID
   * @returns Resolved fetch or null
   */
  resolve_fetch(id: string): ResolvedFetch | null {
    const dir = join(this.base_dir, id);
    const meta_path = join(dir, "index.json");

    if (!existsSync(meta_path)) { return null; }

    let meta: FetchRecordMeta;
    try {
      meta = JSON.parse(readFileSync(meta_path, "utf-8")) as FetchRecordMeta;
    } catch {
      return null;
    }

    const now = Date.now();
    const age = now - meta.fetched_at;

    if (age > DELETE_AFTER_MS) { return null; }

    const status: ResolveStatus = age > STALE_AFTER_MS ? "stale" : "fresh";

    return {
      id: meta.id,
      url: meta.url,
      content_type: meta.content_type,
      fetched_at: meta.fetched_at,
      status,
      chunks: meta.chunks,
    };
  }

  /**
   * Remove expired records (>30 days).
   * @returns Number of records deleted
   */
  cleanup(): number {
    let deleted = 0;
    const now = Date.now();

    let entries: string[];
    try {
      entries = readdirSync(this.base_dir);
    } catch {
      return 0;
    }

    for (const entry of entries) {
      const dir = join(this.base_dir, entry);
      const meta_path = join(dir, "index.json");
      if (!existsSync(meta_path)) { continue; }

      let stat;
      try {
        stat = statSync(meta_path);
      } catch {
        continue;
      }

      let age: number;
      try {
        const meta = JSON.parse(readFileSync(meta_path, "utf-8")) as FetchRecordMeta;
        age = now - meta.fetched_at;
      } catch {
        age = now - stat.mtimeMs;
      }

      if (age > DELETE_AFTER_MS) {
        rmSync(dir, { recursive: true, force: true });
        deleted++;
      }
    }

    return deleted;
  }
}