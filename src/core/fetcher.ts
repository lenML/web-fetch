/**
 * HTTP fetcher module.
 * Uses undici for efficient HTTP/HTTPS requests.
 */

import { request } from "undici";

/**
 * Structured fetch result.
 */
export interface FetchResult {
  /** HTTP status code */
  status: number;
  /** Response body as text */
  body: string;
  /** Content-Type header value (may be undefined) */
  content_type: string | undefined;
}

/**
 * Fetch a URL and return structured response.
 * Uses Node.js built-in fetch (available since Node 18).
 *
 * @param url - Target URL to fetch
 * @returns Promise resolving to FetchResult
 */
export async function fetch_url(url: string): Promise<FetchResult> {
  const response = await request(url);

  const body = await response.body.text();
  const content_type = response.headers["content-type"] as string | undefined;

  return {
    status: response.statusCode,
    body,
    content_type,
  };
}