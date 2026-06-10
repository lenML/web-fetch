import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { TempStore } from "../../src/core/temp_store.js";
import { readFileSync, existsSync, writeFileSync as wfs, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const test_dir = join(tmpdir(), "web-fetch-test-temp-store");

describe("TempStore", () => {
  let store: TempStore;

  beforeEach(() => {
    store = new TempStore({ base_dir: test_dir });
  });

  afterAll(() => {
    try { rmSync(test_dir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  /**
   * Save a fetch record
   * Given a url with html content type
   * When save_fetch is called with chunks
   * Then it should return a fetch ID with files on disk
   */
  it("should save fetch record and files", () => {
    const chunks = [
      { key: "01_intro", title: "Introduction", content: "# Intro\nHello" },
    ];
    const record = store.save_fetch({
      url: "https://example.com",
      content_type: "text/html",
      chunks,
    });

    expect(record.id).toBeTruthy();
    expect(record.chunks).toHaveLength(1);
    expect(record.chunks[0].path).toContain("01_intro");
    expect(existsSync(record.chunks[0].path)).toBe(true);

    const content = readFileSync(record.chunks[0].path, "utf-8");
    expect(content).toBe("# Intro\nHello");
  });

  /**
   * Resolve a fetch record
   * Given a saved fetch record
   * When resolve_fetch is called
   * Then it should return the record
   */
  it("should resolve existing fetch record", () => {
    const chunks = [
      { key: "part_1", title: "Part 1", content: "data" },
    ];
    const saved = store.save_fetch({
      url: "https://example.com",
      content_type: "text/plain",
      chunks,
    });

    const resolved = store.resolve_fetch(saved.id);
    if (resolved == null) { throw new Error("expected record"); }
    expect(resolved.url).toBe("https://example.com");
    expect(resolved.chunks).toHaveLength(1);
  });

  /**
   * Stale after 1 day
   * Given a record with fetched_at beyond 1 day
   * When resolve_fetch is called
   * Then it should return stale status
   */
  it("should mark records older than 1 day as stale", () => {
    const chunks = [
      { key: "old_chunk", title: "Old", content: "test" },
    ];
    const saved = store.save_fetch({
      url: "https://example.com/old",
      content_type: "text/html",
      chunks,
    });

    // manually age metadata
    const meta_path = join(test_dir, saved.id, "index.json");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const meta: { fetched_at: number; chunks: { key: string; title: string; path: string; size: number; created_at: number; expires_at: number }[] } = JSON.parse(readFileSync(meta_path, "utf-8"));
    meta.fetched_at = Date.now() - 2 * 86400 * 1000;
    meta.chunks = meta.chunks.map((c) => ({
      ...c,
      created_at: Date.now() - 2 * 86400 * 1000,
      expires_at: Date.now() - 1 * 86400 * 1000,
    }));

    wfs(meta_path, JSON.stringify(meta, null, 2));

    const resolved = store.resolve_fetch(saved.id);
    if (resolved == null) { throw new Error("expected record"); }
    expect(resolved.status).toBe("stale");
  });

  /**
   * Non-existent ID
   * Given an ID not saved
   * When resolve_fetch is called
   * Then it should return null
   */
  it("should return null for unknown id", () => {
    const result = store.resolve_fetch("nonexistent");
    expect(result).toBeNull();
  });

  /**
   * Cleanup removes files older than 30 days
   * Given files aged beyond 30 days
   * When cleanup is called
   * Then those files should be deleted
   */
  it("should delete records older than 30 days during cleanup", () => {
    const chunks = [
      { key: "very_old", title: "Very Old", content: "gone" },
    ];
    const saved = store.save_fetch({
      url: "https://example.com/old",
      content_type: "text/plain",
      chunks,
    });

    // manually age to 31 days
    const meta_path = join(test_dir, saved.id, "index.json");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const meta: { fetched_at: number } = JSON.parse(readFileSync(meta_path, "utf-8"));
    meta.fetched_at = Date.now() - 31 * 86400 * 1000;
    wfs(meta_path, JSON.stringify(meta, null, 2));

    const cleaned = store.cleanup();
    expect(cleaned).toBeGreaterThan(0);

    const resolved = store.resolve_fetch(saved.id);
    expect(resolved).toBeNull();
  });
});