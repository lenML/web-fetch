import { describe, it, expect } from "vitest";
import { fetch_url } from "../../src/core/fetcher.js";

/**
 * NOTE: These tests require network access.
 * They are marked with .skip by default because they
 * make real HTTP requests to an external test server.
 *
 * To run: remove the .skip and ensure network access.
 */

/**
 * Fetch a real URL
 * Given a valid https URL
 * When fetch_url is called
 * Then it should return a response object with status and body
 */
describe.skip("fetch_url (integration)", () => {
  it("should fetch httpbin html", async () => {
    const res = await fetch_url("https://httpbin.org/html");
    expect(res.status).toBe(200);
    expect(res.body).toBeTruthy();
    expect(res.content_type).toContain("text/html");
  });

  /**
   * Fetch a JSON endpoint
   * Given a URL returning JSON
   * When fetch_url is called
   * Then it should return a response with JSON content type
   */
  it("should fetch json response", async () => {
    const res = await fetch_url("https://httpbin.org/json");
    expect(res.status).toBe(200);
    expect(res.content_type).toContain("application/json");
  });
});