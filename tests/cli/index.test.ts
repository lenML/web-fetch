import { describe, it, expect } from "vitest";
import { run_cli } from "../../src/cli/index.js";

describe("web-fetch CLI", () => {
  /**
   * CLI help text
   * Given no arguments
   * When run_cli is called
   * Then it should print help text and exit
   */
  it("should display help text", async () => {
    const result = await run_cli(["--help"]);
    expect(result).toContain("web-fetch");
  });

  /**
   * CLI version
   * Given --version flag
   * When run_cli is called
   * Then it should print version
   */
  it("should display version", async () => {
    const result = await run_cli(["--version"]);
    expect(result).toMatch(/\d+\.\d+\.\d+/);
  });
});