/**
 * Content type detection module.
 * Parses HTTP Content-Type headers and URL extension to map to internal enum.
 */

/**
 * Supported content types for web-fetch auto-conversion.
 */
export enum ContentType {
  html = "html",
  pdf = "pdf",
  json = "json",
  csv = "csv",
  zip = "zip",
  unknown = "unknown",
}

/**
 * Detect content type from HTTP Content-Type header + URL extension.
 * Falls back to URL extension when header is generic (octet-stream).
 *
 * @param content_type - Raw Content-Type header value
 * @param url - Optional source URL (used for extension-based detection)
 * @returns Detected ContentType enum
 */
export function detect_content_type(content_type: string | undefined, url?: string): ContentType {
  if (content_type != null) {
    const lower = content_type.toLowerCase();

    if (lower.includes("text/html")) { return ContentType.html; }
    if (lower.includes("application/pdf")) { return ContentType.pdf; }
    if (lower.includes("application/json")) { return ContentType.json; }
    if (lower.includes("text/csv")) { return ContentType.csv; }
    if (lower.includes("application/zip") || lower.includes("application/gzip") || lower.includes("application/x-tar")) { return ContentType.zip; }

    // Generic binary — check URL extension
    if (lower.includes("application/octet-stream") && url) {
      const ext = url.toLowerCase().split("?").shift()?.split("#").shift()?.split(".").pop();
      if (ext === "pdf") { return ContentType.pdf; }
      if (ext === "zip" || ext === "tar" || ext === "gz" || ext === "tgz") { return ContentType.zip; }
      if (ext === "csv") { return ContentType.csv; }
      // fall through to unknown
    }
  }

  // No header — try URL extension
  if (url) {
    const ext = url.toLowerCase().split("?").shift()?.split("#").shift()?.split(".").pop();
    if (ext === "pdf") { return ContentType.pdf; }
    if (ext === "json") { return ContentType.json; }
    if (ext === "csv") { return ContentType.csv; }
    if (ext === "zip" || ext === "tar" || ext === "gz" || ext === "tgz") { return ContentType.zip; }
    if (ext === "html" || ext === "htm") { return ContentType.html; }
  }

  return ContentType.unknown;
}