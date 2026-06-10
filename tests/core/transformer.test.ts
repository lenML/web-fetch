import { describe, it, expect } from "vitest";
import { transform_content } from "../../src/core/transformer.js";

describe("transform_content", () => {
  /**
   * Transform HTML content to markdown
   * Given an HTML body with text/html content type
   * When transform_content is called
   * Then it should return markdown text
   */
  it("should transform html to markdown", () => {
    const result = transform_content("<h1>Hi</h1>", "text/html");
    expect(result.type).toBe("markdown");
    expect(result.data).toContain("# Hi");
  });

  /**
   * Transform JSON content to formatted output
   * Given a JSON body with application/json content type
   * When transform_content is called
   * Then it should return formatted JSON
   */
  it("should transform json to formatted output", () => {
    const result = transform_content('{"a":1}', "application/json");
    expect(result.type).toBe("json");
    expect(result.data).toContain('"a"');
  });

  /**
   * Transform unknown content type
   * Given a plain text body with unknown content type
   * When transform_content is called
   * Then it should return the raw text
   */
  it("should return raw text for unknown content type", () => {
    const result = transform_content("plain text", "text/plain");
    expect(result.type).toBe("text");
    expect(result.data).toBe("plain text");
  });
});