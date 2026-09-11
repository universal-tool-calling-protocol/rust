# Rust UTCP website

A responsive landing page and searchable documentation for `rs-utcp`, based on
the companion Ruby UTCP website. It shares the reference layout, typography,
protocol orbit, explorer, and documentation navigation, with a Rust orange
palette and a custom vector mark.

From the **repository root**, with Node.js 20 or newer:

```sh
npm run dev
```

Open http://127.0.0.1:5173. No package installation is needed. To choose another
port, run `npm run dev -- --port 5175`.

## Check, build, and preview

```sh
npm run check
npm run build
npm run preview
```

The build recreates `website/dist/` with only the public pages, styles, browser
scripts, assets, and downloadable examples. Upload its contents to a static
host. All internal links are relative, supporting both a domain root and a
subpath such as `/rs-utcp/`. The Node server is a local preview utility.
The website workflow validates the content and uploads a build artifact;
publishing is configured separately on your chosen host.

## Content

- `index.html`: landing page, 12-protocol explorer, and Cargo quick start.
- `docs.html`: guide shell with shareable topic URLs.
- `data.js`: Rust manuals, complete callers, Rhai workflows, and eight guides.
- `app.js`: tabs, syntax highlighting, clipboard, local search, and mobile menu.
- `styles.css`: responsive design, keyboard focus, and reduced motion support.
- `assets/rust-utcp-mark.svg`: the transparent cog and magnet website mark.
- `examples/`: downloadable files for the local greeting example.

Search with the header button or Command/Ctrl+K. Arrow keys navigate tabs and
search results; Escape closes search or mobile navigation. Each protocol has
Manual, Rust, and Code Mode tabs. Code is displayed and copied, never executed
in the browser. The Code Mode examples host **Rhai** scripts in Rust.

Examples target the `rs-utcp` 0.3.2 API. Follow the quick start for
the dependency list and `protoc` requirement. The local example uses Node.js to
execute `tools/hello.js`; other protocol examples require matching servers.
The Text transport executes local scripts; `http_stream` is the Rust HTTP
streaming template type; `StreamResult::next` returns `Result<Option<Value>>`.

`npm run check` validates JSON manual shapes, matching tool names, local links,
and agreement between displayed and downloadable quick start files. When a root
`Cargo.toml` is present, it also checks that the website version matches the crate.
Standalone website checkouts do not require the crate manifest. The check does
not compile Rust or contact example servers.

DM Sans and IBM Plex Mono load from Google Fonts when available, with system
font fallbacks. All other website assets and search work locally.
