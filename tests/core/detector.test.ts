import { describe, it, expect } from "vitest";
import { detect_content_type, ContentType } from "../../src/core/detector.js";

describe("detect_content_type", () => {
  /**
   * HTML content type detection
   * Given a content-type header of "text/html; charset=utf-8"
   * When detect_content_type is called
   * Then it should return ContentType.html
   */
  it("should detect html content type", () => {
    const result = detect_content_type("text/html; charset=utf-8");
    expect(result).toBe(ContentType.html);
  });

  /**
   * PDF content type detection
   * Given a content-type header of "application/pdf"
   * When detect_content_type is called
   * Then it should return ContentType.pdf
   */
  it("should detect pdf content type", () => {
    const result = detect_content_type("application/pdf");
    expect(result).toBe(ContentType.pdf);
  });

  /**
   * JSON content type detection
   * Given a content-type header of "application/json"
   * When detect_content_type is called
   * Then it should return ContentType.json
   */
  it("should detect json content type", () => {
    const result = detect_content_type("application/json");
    expect(result).toBe(ContentType.json);
  });

  /**
   * Unknown content type fallback
   * Given a content-type header of "application/octet-stream"
   * When detect_content_type is called
   * Then it should return ContentType.unknown
   */
  it("should return unknown for unrecognized content types", () => {
    const result = detect_content_type("application/octet-stream");
    expect(result).toBe(ContentType.unknown);
  });

  /**
   * Missing content type
   * Given a undefined content-type header
   * When detect_content_type is called
   * Then it should return ContentType.unknown
   */
  it("should return unknown for missing content type", () => {
    const result = detect_content_type(undefined);
    expect(result).toBe(ContentType.unknown);
  });
});