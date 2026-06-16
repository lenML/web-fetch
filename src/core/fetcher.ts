/**
 * HTTP fetcher module.
 * Uses undici for efficient HTTP/HTTPS requests.
 * Auto-discovers proxy when direct connection fails.
 * Returns body as Buffer — callers decode text when needed.
 */

import { request, ProxyAgent } from "undici";

/** Default max download size: 100 MB. */
const MAX_DOWNLOAD_SIZE = 100 * 1024 * 1024;

/**
 * Structured fetch result.
 * body is always raw bytes; decode to string for text-based types.
 */
export interface FetchResult {
  /** HTTP status code */
  status: number;
  /** Response body as raw bytes */
  body: Buffer;
  /** Content-Type header value (may be undefined) */
  content_type: string | undefined;
}

/** Known HTTP proxy endpoints (from environment / known infrastructure). */
function get_system_proxies(): string[] {
  const seen = new Set<string>();

  for (const env_name of ["https_proxy", "HTTPS_PROXY", "http_proxy", "HTTP_PROXY", "all_proxy", "ALL_PROXY"]) {
    const val = process.env[env_name];
    if (val && !seen.has(val)) {
      seen.add(val);
    }
  }

  for (const url of ["http://nas:7890", "http://127.0.0.1:10808"]) {
    if (!seen.has(url)) { seen.add(url); }
  }

  return Array.from(seen);
}

async function do_fetch(url: string, proxy_url?: string): Promise<FetchResult> {
  const dispatcher = proxy_url ? new ProxyAgent(proxy_url) : undefined;
  const response = await request(url, { dispatcher });

  // Check Content-Length header before streaming body
  const content_length_str = response.headers["content-length"] as string | undefined;
  if (content_length_str) {
    const content_length = parseInt(content_length_str, 10);
    if (!isNaN(content_length) && content_length > MAX_DOWNLOAD_SIZE) {
      throw new Error(`Download too large: ${content_length} bytes exceeds ${MAX_DOWNLOAD_SIZE} byte limit`);
    }
  }

  const chunks: Buffer[] = [];
  let total_size = 0;
  for await (const chunk of response.body) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total_size += buf.length;
    if (total_size > MAX_DOWNLOAD_SIZE) {
      throw new Error(`Download exceeded ${MAX_DOWNLOAD_SIZE} byte limit after ${total_size} bytes`);
    }
    chunks.push(buf);
  }
  const body = Buffer.concat(chunks);
  const content_type = response.headers["content-type"] as string | undefined;

  return {
    status: response.statusCode,
    body,
    content_type,
  };
}

/**
 * Fetch a URL and return structured response.
 * Tries direct connection first; on failure, falls back to system-configured proxies.
 *
 * @param url - Target URL to fetch
 * @param proxy_url - Optional explicit proxy URL (skips auto-discovery)
 * @returns Promise resolving to FetchResult
 */
export async function fetch_url(url: string, proxy_url?: string): Promise<FetchResult> {
  if (proxy_url) {
    return do_fetch(url, proxy_url);
  }

  try {
    return await do_fetch(url);
  } catch {
    // fall through to proxy discovery
  }

  const proxies = get_system_proxies();
  let last_error: Error | undefined;

  for (const p of proxies) {
    try {
      return await do_fetch(url, p);
    } catch (err) {
      last_error = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw last_error ?? new Error(`Cannot fetch ${url}: all connection attempts failed`);
}