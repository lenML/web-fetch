import { describe, it, expect } from "vitest";
import { chunk_html_by_headings, chunk_json_by_keys, should_chunk } from "../../src/core/chunker.js";

describe("should_chunk", () => {
  /**
   * Small content should not be chunked
   * Given content of 100 bytes
   * When should_chunk is called
   * Then it should return false
   */
  it("should not chunk small content", () => {
    expect(should_chunk("a".repeat(100))).toBe(false);
  });

  /**
   * Large content should be chunked
   * Given content of 60KB
   * When should_chunk is called
   * Then it should return true
   */
  it("should chunk content over 50KB", () => {
    expect(should_chunk("a".repeat(60 * 1024))).toBe(true);
  });
});

describe("chunk_html_by_headings", () => {
  /**
   * Split HTML by h1/h2 headings
   * Given HTML with multiple h2 sections
   * When chunk_html_by_headings is called
   * Then it should return chunks for each section
   */
  it("should split html by headings", () => {
    const html = `
      <h1>Main Title</h1>
      <p>Intro</p>
      <h2>Section 1</h2>
      <p>Content 1</p>
      <h2>Section 2</h2>
      <p>Content 2</p>
    `;
    const chunks = chunk_html_by_headings(html);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // The first chunk after the title should be Section 1
    const section_titles = chunks.map(c => c.title);
    expect(section_titles).toContain("Main Title");
    expect(section_titles).toContain("Section 1");
    expect(section_titles).toContain("Section 2");
  });

  /**
   * HTML without headings
   * Given HTML with only paragraph text
   * When chunk_html_by_headings is called
   * Then it should return a single chunk
   */
  it("should return single chunk for headingless html", () => {
    const html = "<p>Just text</p><p>More text</p>";
    const chunks = chunk_html_by_headings(html);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].title).toBe("content");
  });
});

describe("chunk_json_by_keys", () => {
  /**
   * Split JSON object by top-level keys
   * Given a JSON object with multiple top-level keys
   * When chunk_json_by_keys is called
   * Then it should return a chunk for each key
   */
  it("should split json object by top-level keys", () => {
    const json = JSON.stringify({
      title: "Report",
      authors: ["Alice"],
      data: { value: 42 },
      metadata: { version: 1 },
    });
    const chunks = chunk_json_by_keys(json);
    const titles = chunks.map(c => c.title);
    expect(titles).toContain("title");
    expect(titles).toContain("authors");
    expect(titles).toContain("data");
    expect(titles).toContain("metadata");
    expect(chunks.length).toBeGreaterThanOrEqual(4);
  });

  /**
   * JSON array should be split by elements
   * Given a JSON array with multiple elements
   * When chunk_json_by_keys is called
   * Then it should return a chunk per element
   */
  it("should split json array by elements", () => {
    const json = JSON.stringify([
      { id: 1, name: "First" },
      { id: 2, name: "Second" },
      { id: 3, name: "Third" },
    ]);
    const chunks = chunk_json_by_keys(json);
    expect(chunks.length).toBe(3);
    expect(chunks[0].title).toContain("[0]");
    expect(chunks[1].title).toContain("[1]");
  });

  /**
   * Simple JSON value (string/number) should return single chunk
   * Given a simple scalar JSON
   * When chunk_json_by_keys is called
   * Then it should return one chunk
   */
  it("should return single chunk for scalar json", () => {
    const chunks = chunk_json_by_keys('"hello"');
    expect(chunks).toHaveLength(1);
  });
});