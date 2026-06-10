/**
 * Content transformer module.
 * Auto-detects content type and applies appropriate conversion.
 */

import { ContentType, detect_content_type } from "./detector.js";
import { convert_html_to_markdown, convert_json_to_toon } from "./converter.js";

/**
 * Result of a content transformation.
 */
export interface TransformResult {
  /** Human-readable output type label */
  type: string;
  /** Transformed content data */
  data: string;
}

/**
 * Auto-detect content type from Content-Type header and transform raw body.
 *
 * @param body - Raw response body string
 * @param content_type_header - HTTP Content-Type header value
 * @returns TransformResult with type label and transformed data
 */
export function transform_content(
  body: string,
  content_type_header: string | undefined,
): TransformResult {
  const content_type = detect_content_type(content_type_header);

  switch (content_type) {
    case ContentType.html: {
      return {
        type: "markdown",
        data: convert_html_to_markdown(body),
      };
    }

    case ContentType.json: {
      return {
        type: "json",
        data: convert_json_to_toon(body),
      };
    }

    case ContentType.pdf: {
      // pdf-parse is async, handled at fetch level
      return {
        type: "pdf",
        data: body,
      };
    }

    default: {
      return {
        type: "text",
        data: body,
      };
    }
  }
}