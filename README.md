# web-fetch

Fetch web content — auto-convert, chunk, cache with progressive disclosure.

```bash
web-fetch <url>
```

HTML → Markdown, JSON → formatted, PDF → text sections, CSV → table.
Large content → auto-chunked temp cache. Original binaries preserved.

## Install

```bash
pnpm add -g @lenml/web-fetch
# or
npx @lenml/web-fetch <url>
```

## Usage

```bash
# Small content: inline output
web-fetch https://example.com

# Large content: auto-chunked, first chunk previewed
web-fetch https://example.com/large-doc

# PDF: original preserved + text extracted by sections
web-fetch https://example.com/paper.pdf

# CSV: formatted as markdown table, chunks of 100 rows
web-fetch https://example.com/data.csv

# ZIP: file listing + extracted text files content
web-fetch https://example.com/archive.zip

# Show cached index
web-fetch --cache <id>

# Show specific chunk
web-fetch --cache <id> --chunk <key>

# List all cached fetches
web-fetch

# Through proxy
web-fetch --proxy http://127.0.0.1:10808 https://example.com

# Raw output (no conversion)
web-fetch -r https://example.com
```

## Options

| Flag | Description |
|------|-------------|
| `--proxy <url>` | HTTP/SOCKS proxy (skip auto-discovery) |
| `--cache <id>` | View cached fetch index |
| `--chunk <key>` | View chunk from cache (use with `--cache <id>`) |
| `-r, --raw` | Raw binary output, no conversion |
| `-i, --inline` | Force inline output, no chunking |
| `-g, --global-cache` | Use OS temp dir instead of local `.fetch-cache/` |
| `-h, --help` | Show help |
| `--version` | Show version |

## Design

### Progressive Disclosure

Content auto-saved to `.fetch-cache/` (local CWD) or `$TMPDIR/web-fetch-cache/` (global):

- **<50KB** — inline output
- **>50KB** — split into chunks, first chunk previewed, remaining chunks referenced by key
- **>1 day** — cache marked stale (metadata preserved, content needs re-fetch)
- **>30 days** — cache auto-deleted on next cleanup

### Content Handling

| Type | Conversion | Chunking |
|------|-----------|----------|
| HTML | Turndown → Markdown | By h1/h2/h3 headings |
| JSON | Pretty-print (2-space) | By top-level keys / array elements |
| PDF | pdf-parse v2 text extraction | By detected headings, min 1000 chars per chunk |
| CSV | Markdown table | 100 rows per chunk (header repeated) |
| ZIP | File listing + text file extraction | Per-file chunks |
| Binary (image, etc.) | Saved as-is | Single file |
| Unknown text | Raw | Paragraph split fallback |

### Proxy Auto-Discovery

Direct connection attempted first. On failure, reads `HTTP_PROXY`, `HTTPS_PROXY`, `all_proxy` env vars, then tries known endpoints (`http://nas:7890`, `http://127.0.0.1:10808`).

### Caching

Default cache is project-local `.fetch-cache/`. Use `--global-cache` for OS temp directory. Each fetch creates a subdirectory with `index.json` (metadata) and chunk files. Stale records (1d+) show metadata but mark content as expired. Very old records (30d+) auto-deleted.

## Dev

```bash
pnpm test
pnpm lint
pnpm typecheck
```

Built with:
- **vite** / **vitest**
- **undici** (HTTP fetch)
- **turndown** (HTML to Markdown)
- **jsdom** (HTML parsing)
- **pdf-parse** v2 (PDF text extraction)
- **adm-zip** (ZIP extraction)
- **commander** (CLI framework)
- **picocolors** (terminal colors)
- **eslint** + **typescript-eslint** (strict)
- **TypeScript 6** + strict mode
