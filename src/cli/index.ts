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
import { transform_content, TempStore } from "../core/transformer.js";
import type { ResolvedFetch } from "../core/transformer.js";
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
  .description("Fetch web content — auto-convert and cache to temp files")
  .version(get_version())
  .argument("[url]", "URL to fetch (omit to list cache)")
  .option("-r, --raw", "Output raw content without transformation")
  .option("-i, --inline", "Force inline output (disable progressive disclosure)")
  .option("--proxy <url>", "HTTP/SOCKS proxy (e.g. http://127.0.0.1:10808)")
  .option("--cache <id>", "View cached fetch index by ID")
  .option("--chunk <key>", "View a specific chunk from a cached record (use with --cache <id>)")
  .action(async (url: string | undefined, options: { raw?: boolean; inline?: boolean; proxy?: string; cache?: string; chunk?: string }) => {
    try {
      // --cache <id> : show index
      if (options.cache && !options.chunk) {
        const store = new TempStore();
        const record = store.resolve_fetch(options.cache);
        if (!record) {
          console.error(pico.red(`Record not found or expired: ${options.cache}`));
          process.exit(1);
        }
        console.log(format_index(record));
        return;
      }

      // --cache <id> --chunk <key> : show chunk content
      if (options.cache && options.chunk) {
        const store = new TempStore();
        const record = store.resolve_fetch(options.cache);
        if (!record) {
          console.error(pico.red(`Record not found: ${options.cache}`));
          process.exit(1);
        }
        const chunk = record.chunks.find(c => c.key === options.chunk);
        if (!chunk) {
          console.error(pico.red(`Chunk "${options.chunk}" not found in record ${options.cache}`));
          process.exit(1);
        }
        console.log(readFileSync(chunk.path, "utf-8"));
        return;
      }

      // No URL → list cache
      if (!url) {
        const store = new TempStore();
        const list = store.list_fetches();
        if (list.length === 0) {
          console.log(pico.dim("No cached fetches."));
          return;
        }
        for (const item of list) {
          const age = Math.round((Date.now() - item.fetched_at) / 1000 / 60);
          const status_tag = item.status === "stale" ? pico.yellow("stale") : pico.green("fresh");
          console.log(`  ${pico.bold(item.id)}  ${status_tag}  ${format_age(age)}  ${pico.dim(item.url)}`);
        }
        return;
      }

      // Normal fetch
      console.error(pico.cyan(`  Fetching: ${url}`));

      const result = await fetch_url(url, options.proxy);

      if (result.status >= 400) {
        console.error(pico.red(`Error: HTTP ${result.status}`));
        process.exit(1);
      }

      if (options.raw) {
        console.log(result.body);
        return;
      }

      const transformed = transform_content(result.body, result.content_type, url);

      if (transformed.inline || options.inline) {
        console.log(transformed.data);
      } else {
        // Progressive disclosure: show index on stderr + stdout
        if (transformed.fetch_record) {
          const size = transformed.fetch_record.chunks.reduce((s, c) => s + c.size, 0);
          console.error(pico.cyan(`  ${format_size(size)}, ${transformed.fetch_record.chunks.length} chunks — cached to ${transformed.fetch_record.id}`));
          console.error("");
          if (transformed.fetch_record.chunks.length > 0) {
            const first = transformed.fetch_record.chunks[0];
            console.error(pico.dim(`  First chunk preview (--cache ${transformed.fetch_record.id} --chunk ${first.key}):`));
            console.log(transformed.chunks[0]?.content ?? "");
          }
          console.error("");
          console.error(pico.dim(`  Show index:  web-fetch --cache ${transformed.fetch_record.id}`));
          console.error(pico.dim(`  Show chunk:  web-fetch --cache ${transformed.fetch_record.id} --chunk <key>`));
        }
      }
    } catch (err) {
      console.error(
        pico.red(`Error: ${err instanceof Error ? err.message : String(err)}`),
      );
      process.exit(1);
    }
  });

program.exitOverride();

function format_index(record: ResolvedFetch): string {
  const lines: string[] = [
    `URL: ${record.url}`,
    `Type: ${record.content_type}`,
    `Fetched: ${new Date(record.fetched_at).toISOString()}`,
    `Status: ${record.status}`,
    "",
    "Chunks:",
  ];

  for (const [i, chunk] of record.chunks.entries()) {
    lines.push(`  ${String(i + 1).padStart(2)}. ${chunk.title}  → ${chunk.path}  (${format_size(chunk.size)})`);
  }

  lines.push("");
  if (record.chunks.length > 0) {
    lines.push(`  Use: web-fetch --cache ${record.id} --chunk ${record.chunks[0].key}`);
  }

  return lines.join("\n");
}

function format_size(bytes: number): string {
  if (bytes < 1024) { return `${bytes} B`; }
  if (bytes < 1024 * 1024) { return `${(bytes / 1024).toFixed(1)} KB`; }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function format_age(minutes: number): string {
  if (minutes < 1) { return "just now"; }
  if (minutes < 60) { return `${minutes}m ago`; }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) { return `${hours}h ago`; }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

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