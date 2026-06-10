#!/usr/bin/env node

/**
 * web-fetch CLI entry point.
 * Usage: web-fetch <url> [options]
 */

import { Command } from "commander";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { fetch_url } from "../core/fetcher.js";
import { transform_content } from "../core/transformer.js";
import pico from "picocolors";

function get_version(): string {
  const pkg_path = resolve(dirname(fileURLToPath(import.meta.url)), "../../package.json");
  const pkg_text = readFileSync(pkg_path, "utf-8");
  const pkg = JSON.parse(pkg_text) as { version: string };
  return pkg.version;
}

const program = new Command();

program
  .name("web-fetch")
  .description("Fetch web content and auto-convert to compressed formats")
  .version(get_version())
  .argument("<url>", "URL to fetch")
  .option("-r, --raw", "Output raw content without transformation")
  .option("-t, --type <type>", "Force output type (markdown, json, text)")
  .action(async (url: string, options: { raw?: boolean; type?: string }) => {
    try {
      console.error(pico.cyan(`  Fetching: ${url}`));

      const result = await fetch_url(url);

      if (result.status >= 400) {
        console.error(pico.red(`Error: HTTP ${result.status}`));
        process.exit(1);
      }

      if (options.raw) {
        console.log(result.body);
        return;
      }

      const transformed = transform_content(result.body, result.content_type);
      console.log(transformed.data);
    } catch (err) {
      console.error(
        pico.red(`Error: ${err instanceof Error ? err.message : String(err)}`),
      );
      process.exit(1);
    }
  });

program.exitOverride();

export async function run_cli(args: string[]): Promise<string> {
  const stdout_chunks: string[] = [];
  const stderr_chunks: string[] = [];

  const original_stdout_write = process.stdout.write;
  const original_stderr_write = process.stderr.write;
  const original_log = console.log;
  const original_error = console.error;
  const original_exit = process.exit;

  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    stdout_chunks.push(String(chunk));
    return true;
  });

  process.stderr.write = ((chunk: string | Uint8Array): boolean => {
    stderr_chunks.push(String(chunk));
    return true;
  });

  const capture_stdout = (...msgs: string[]): void => {
    stdout_chunks.push(msgs.join(" ") + "\n");
  };
  console.log = capture_stdout;
  const capture_stderr = (...msgs: string[]): void => {
    stderr_chunks.push(msgs.join(" ") + "\n");
  };
  console.error = capture_stderr;
  const exit_override = (_code?: number): never => {
    throw new Error(`process.exit(${String(_code ?? 0)})`);
  };
  process.exit = exit_override;

  try {
    await program.parseAsync(args, { from: "user" });
  } catch {
    // exitOverride throws on help/version
  } finally {
    process.stdout.write = original_stdout_write;
    process.stderr.write = original_stderr_write;
    console.log = original_log;
    console.error = original_error;
    process.exit = original_exit;
  }

  return stdout_chunks.join("");
}

const is_main =
  process.argv.length >= 2 &&
  (process.argv[1]?.includes("web-fetch") ?? false) &&
  !process.env.VITEST;

if (is_main) {
  try {
    program.parse(process.argv);
  } catch {
    // exitOverride throws - ignore for direct CLI usage
  }
}