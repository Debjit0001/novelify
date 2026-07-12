# Novelify (NovelRead)

A mobile-first, installable PWA for reading PDF novels — upload a PDF and Novelify turns every page into smooth, reflowable, scrollable text tuned for one-handed phone reading, instead of rendering a stiff, zoomed-out page image.

Everything runs client-side. Books are parsed in the browser with `pdf.js` and stored locally in IndexedDB, so there's no backend, no accounts, and no file ever leaves the device.

## Why

Most in-browser PDF viewers just render pages as fixed-size images or canvases, which is miserable on a phone: constant pinch-zooming, tiny text, horizontal scrolling. Novelify instead extracts the raw text layer from each PDF page and re-flows it into normal, wrapping HTML paragraphs — so font size, background, and typeface are all yours to control, and the text behaves like a real e-reader instead of a scanned page.

## Features

- **Reflowable text rendering** — Reconstructs paragraphs and lines from raw PDF.js text-position data (no OCR, no fixed layout) so text wraps naturally at any screen width or font size.
- **Local library** — Upload multiple PDFs; they're listed as cover cards with title, page count, and reading progress. Everything is stored in IndexedDB via `idb-keyval`.
- **Resume where you left off** — Per-book bookmarks (last page read) persist in `localStorage` and are restored automatically.
- **Parsed-page caching** — The (expensive) PDF.js text extraction only happens once per book. The parsed result is serialized and cached in IndexedDB, so reopening a book is near-instant instead of re-parsing the PDF.
- **Reading customization** — Toggle between serif / sans / mono fonts, white / sepia / dark reading backgrounds, adjustable font size (12–28px), and an independent global light/dark UI theme.
- **Immersive reading UI** — Tap the page to hide/show the header and navigation bars; swipe left/right to turn pages; tap the page counter to jump directly to a page number.
- **Installable PWA** — Full manifest, service worker, offline app-shell caching, and native "Add to Home Screen" install prompts on iOS and Android.
- **Zero backend** — No server, no database, no auth. Purely a static Next.js app; your books never leave your device.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) + React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com/) (`base-nova` style) |
| PDF parsing | [`pdfjs-dist`](https://github.com/mozilla/pdf.js) (runs entirely in-browser, off the main text-rendering path) |
| Local storage | [`idb-keyval`](https://github.com/jakearchibald/idb-keyval) (IndexedDB) for book blobs, metadata, and parsed-page cache; `localStorage` for bookmarks |
| Icons | [lucide-react](https://lucide.dev/) |
| Analytics | `@vercel/analytics` (production only) |
| PWA | Custom `manifest.json` + hand-written service worker (`public/sw.js`) |

## Getting Started

### Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/) (the project ships a `pnpm-lock.yaml`)

### Install & run

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and upload a PDF to start reading.

### Other scripts

```bash
pnpm build   # production build
pnpm start   # serve the production build
pnpm lint    # run eslint
```

## Project Structure

```
app/
  layout.tsx              Root layout: fonts, PWA meta tags, theme-color, Analytics
  page.tsx                Entry point — wraps ReaderApp in ReaderProvider
  globals.css             Tailwind v4 theme tokens (light/dark, reading backgrounds)

components/
  reader/
    ReaderContext.tsx      Global app state (active book, current page, UI visibility,
                            font/background/size prefs) via React Context
    ReaderApp.tsx           Top-level shell: routes between library / loading / error /
                            reading states, registers the service worker, handles the
                            PWA install prompt
    PdfLoader.tsx            Hook (`usePdfLoader`) that parses PDFs with pdf.js, restores
                            the last-opened book on launch, and orchestrates the cache
    pageSerializer.ts       Serializes/deserializes parsed PdfPage data for IndexedDB caching
    useBookStorage.ts       IndexedDB (idb-keyval) persistence layer: book blobs, metadata,
                            parsed-page cache, and localStorage bookmarks
    LibraryDashboard.tsx     Grid of saved books with progress bars, delete, and "add book" FAB
    ReadingPane.tsx          Core reading UI: reflow text-layout algorithm, swipe/tap
                            gestures, page navigation, page-jump input
    ReadingToolbar.tsx       Background / font / font-size controls
    TopHeader.tsx            Sticky header shown while reading (title, page count, theme toggle)
    EmptyState.tsx           First-run upload prompt (drag & drop or tap to browse)
  ui/
    button.tsx              shadcn/ui Button primitive

lib/
  utils.ts                 `cn()` class-merging helper (clsx + tailwind-merge)

public/
  manifest.json             PWA manifest (icons, theme colors, standalone display)
  sw.js                     Service worker: cache-first strategy + offline app-shell fallback
  icon-*.png, icon.svg      App icons (192/512, light/dark, Apple touch icon)
```

## How Text Reflow Works

Standard PDF text has absolute `(x, y)` coordinates per glyph run — there's no inherent concept of "paragraph" or "line wrap." `ReadingPane.tsx` rebuilds that structure heuristically:

1. **Decode positions** — Reads each text item's transform matrix from `pdf.js` to recover its x/y position and font size.
2. **Group into lines** — Items within a small vertical tolerance of each other (relative to font size) are merged into a single visual line.
3. **Detect paragraphs** — A new paragraph starts when either the vertical gap between lines is unusually large (a blank-line separator) or a line is indented relative to the page's dominant left margin (the classic novel first-line indent).
4. **Normalize font sizes** — Outlier glyphs — most commonly oversized drop caps — are clamped to the body text's median font size so they don't blow up line heights, while still allowing legitimate headings a bit of extra size.
5. **Render as flowing HTML** — Each paragraph becomes a real `<p>` with `white-space: pre-wrap` and dynamic `font-size`, so the browser handles word-wrap naturally and the user's font-size setting reflows every page live.

This means Novelify never renders a rasterized page image — it's real, selectable, resizable text reconstructed from the PDF's content stream.

## Data & Privacy

- Books (raw PDF blobs), their metadata, and cached parsed text all live in the browser's **IndexedDB** — nothing is uploaded anywhere.
- Reading position (bookmarks) is stored in **`localStorage`**.
- Deleting a book from the library wipes its blob, metadata, parsed cache, and bookmark together.
- The only network call in production is `@vercel/analytics` for anonymous usage metrics.

## PWA / Offline Support

Novelify is fully installable:

- `public/manifest.json` defines standalone display mode, theme colors, and maskable icons for Android/iOS home-screen install.
- `public/sw.js` implements a cache-first service worker with an offline fallback to the app shell for navigation requests.
- `ReaderApp.tsx` listens for the `beforeinstallprompt` event and shows an in-app "Add to Home Screen" banner.
- Because books are stored locally, previously opened titles remain fully readable offline once cached.

## Known Limitations

- Image-only / scanned PDF pages (no embedded text layer) show a "no selectable text" message rather than an image render.
- Reflow heuristics are tuned for typical prose/novel layouts; complex multi-column or heavily illustrated PDFs (textbooks, comics, magazines) may not reflow cleanly.
- No cloud sync — your library is local to a single browser/device.
