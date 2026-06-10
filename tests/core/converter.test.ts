import { describe, it, expect } from "vitest";
import { convert_html_to_markdown, convert_json_to_toon } from "../../src/core/converter.js";

describe("convert_html_to_markdown", () => {
  /**
   * Basic HTML to Markdown conversion
   * Given a simple HTML snippet with a heading and paragraph
   * When convert_html_to_markdown is called
   * Then it should return equivalent markdown
   */
  it("should convert basic html to markdown", () => {
    const html = "<h1>Hello</h1><p>World</p>";
    const md = convert_html_to_markdown(html);
    expect(md).toContain("# Hello");
    expect(md).toContain("World");
  });

  /**
   * HTML with links
   * Given HTML containing an anchor tag
   * When convert_html_to_markdown is called
   * Then it should produce markdown link syntax
   */
  it("should convert html links to markdown", () => {
    const html = '\u003ca href=\"https://example.com\"\u003eExample\u003c/a\u003e';
    const md = convert_html_to_markdown(html);
    expect(md).toContain("[Example](https://example.com)");
  });

  /**
   * Empty HTML string
   * Given an empty HTML string
   * When convert_html_to_markdown is called
   * Then it should return an empty string
   */
  it("should handle empty html", () => {
    expect(convert_html_to_markdown("")).toBe("");
  });
});

describe("convert_json_to_toon", () => {
  /**
   * Pretty print JSON object
   * Given a JSON string with an object
   * When convert_json_to_toon is called
   * Then it should return formatted JSON string
   */
  it("should format json object", () => {
    const json = '{"name": "test", "value": 42}';
    const result = convert_json_to_toon(json);
    expect(result).toContain('"name"');
    expect(result).toContain('"test"');
    expect(result).toContain('"value"');
    expect(result).toContain("42");
  });

  /**
   * Pretty print JSON array
   * Given a JSON string with an array
   * When convert_json_to_toon is called
   * Then it should return formatted JSON with array
   */
  it("should format json array", () => {
    const json = '[1, 2, 3]';
    const result = convert_json_to_toon(json);
    expect(result).toContain("1");
    expect(result).toContain("2");
    expect(result).toContain("3");
  });

  /**
   * Invalid JSON handling
   * Given an invalid JSON string
   * When convert_json_to_toon is called
   * Then it should throw an error
   */
  it("should throw on invalid json", () => {
    expect(() => convert_json_to_toon("not json")).toThrow();
  });
});