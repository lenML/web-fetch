/**
 * Content type detection module.
 * Parses HTTP Content-Type headers and maps to internal enum.
 */

/**
 * Supported content types for web-fetch auto-conversion.
 */
export enum ContentType {
  html = "html",
  pdf = "pdf",
  json = "json",
  unknown = "unknown",
}

/**
 * Detect content type from HTTP Content-Type header string.
 * @param content_type - Raw Content-Type header value (e.g. "text/html; charset=utf-8")
 * @returns Detected ContentType enum
 */
export function detect_content_type(content_type: string | undefined): ContentType {
  if (content_type == null) {
    return ContentType.unknown;
  }

  const lower = content_type.toLowerCase();

  if (lower.includes("text/html")) {
    return ContentType.html;
  }

  if (lower.includes("application/pdf")) {
    return ContentType.pdf;
  }

  if (lower.includes("application/json")) {
    return ContentType.json;
  }

  return ContentType.unknown;
}