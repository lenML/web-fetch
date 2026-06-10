import { describe, it, expect } from "vitest";
import { transform_content } from "../../src/core/transformer.js";

describe("transform_content", () => {
  /**
   * Transform small HTML to markdown inline
   * Given a small HTML body with text/html
   * When transform_content is called
   * Then it should return inline=true with markdown data
   */
  it("should transform small html to inline markdown", () => {
    const result = transform_content("<h1>Hi</h1>", "text/html");
    expect(result.inline).toBe(true);
    expect(result.type).toBe("markdown");
    expect(result.data).toContain("# Hi");
    expect(result.chunks).toEqual([]);
  });

  /**
   * Transform small JSON to inline formatted output
   * Given a small JSON body with application/json
   * When transform_content is called
   * Then it should return inline=true with formatted JSON
   */
  it("should transform small json to inline output", () => {
    const result = transform_content('{"a":1}', "application/json");
    expect(result.inline).toBe(true);
    expect(result.type).toBe("json");
    expect(result.data).toContain('"a"');
  });

  /**
   * Transform unknown content type inline
   * Given small plain text with unknown type
   * When transform_content is called
   * Then it should return inline=true with raw text
   */
  it("should return inline raw text for unknown small content", () => {
    const result = transform_content("plain text", "text/plain");
    expect(result.inline).toBe(true);
    expect(result.type).toBe("text");
    expect(result.data).toBe("plain text");
  });

  /**
   * Chunk large HTML by headings
   * Given a large HTML body with multiple sections
   * When transform_content is called
   * Then it should chunk and save to temp store
   */
  it("should chunk large html and save to temp store", () => {
    const sections = Array.from({ length: 5 }, (_, i) => `
      <h2>Section ${i}</h2>
      <p>${"x".repeat(15 * 1024)}</p>
    `).join("\n");
    const html = `<h1>Big Doc</h1>${sections}`;

    const result = transform_content(html, "text/html");
    expect(result.inline).toBe(false);
    expect(result.type).toBe("markdown");
    expect(result.fetch_record).toBeDefined();
    expect(result.chunks.length).toBeGreaterThanOrEqual(5);
  });

  /**
   * Chunk large JSON by top-level keys
   * Given a large JSON object with many keys
   * When transform_content is called
   * Then it should chunk and save to temp store
   */
  it("should chunk large json and save to temp store", () => {
    const big_obj: Record<string, string> = {};
    for (let i = 0; i < 10; i++) {
      big_obj[`key_${i}`] = "x".repeat(10 * 1024);
    }
    const json = JSON.stringify(big_obj);

    const result = transform_content(json, "application/json");
    expect(result.inline).toBe(false);
    expect(result.fetch_record).toBeDefined();
    expect(result.chunks.length).toBe(10);
  });
});