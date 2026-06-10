# web-fetch

Fetch web content — auto-convert and cache to temp files.

```
web-fetch <url>
```

HTML → Markdown, JSON → formatted. Large content → chunked temp cache with progressive disclosure.

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

# Show cached index
web-fetch --cache <id>

# Show specific chunk
web-fetch --cache <id> --chunk <key>

# List all cached fetches
web-fetch

# Through proxy
web-fetch --proxy http://127.0.0.1:10808 https://example.com

# Raw output
web-fetch --raw https://example.com
```

## Options

| Flag | Description |
|------|-------------|
| `--proxy <url>` | HTTP/SOCKS proxy (e.g. `http://127.0.0.1:10808`) |
| `--cache <id>` | View cached fetch index |
| `--chunk <key>` | View chunk from cache (use with `--cache <id>`) |
| `-r, --raw` | Raw output, no conversion |
| `-i, --inline` | Force inline output, no chunking |
| `-h, --help` | Show help |
| `--version` | Show version |

## Progressive Disclosure

Content auto-saved to `$TMPDIR/web-fetch-cache/`:

- **<50KB** — inline output
- **>50KB** — split into chunks (HTML by headings using innerHTML, JSON by keys), first chunk shown inline
- **>1 day** — cache marked stale (metadata preserved)
- **>30 days** — cache auto-deleted

## Cache Management

```bash
# List cached fetches
web-fetch

# View cache index
web-fetch --cache a1b2c3d4

# View specific chunk
web-fetch --cache a1b2c3d4 --chunk section_1
```

## Dev

```bash
pnpm test
pnpm lint
pnpm typecheck
```