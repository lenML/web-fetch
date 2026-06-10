/**
 * HTTP fetcher module.
 * Uses undici for efficient HTTP/HTTPS requests.
 */

import { request, ProxyAgent } from "undici";

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
 * Supports optional proxy via undici ProxyAgent.
 *
 * @param url - Target URL to fetch
 * @param proxy_url - Optional proxy URL (e.g. "http://127.0.0.1:10808")
 * @returns Promise resolving to FetchResult
 */
export async function fetch_url(url: string, proxy_url?: string): Promise<FetchResult> {
  const dispatcher = proxy_url ? new ProxyAgent(proxy_url) : undefined;
  const response = await request(url, { dispatcher });

  const body = await response.body.text();
  const content_type = response.headers["content-type"] as string | undefined;

  return {
    status: response.statusCode,
    body,
    content_type,
  };
}