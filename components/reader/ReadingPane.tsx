"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useReader, type PdfPage, type PdfTextItem } from "./ReaderContext"
import { ReadingToolbar } from "./ReadingToolbar"

const BG_CLASS: Record<string, string> = {
  white: "reading-bg-white",
  dark: "reading-bg-dark",
  sepia: "reading-bg-sepia",
}

const FONT_CLASS: Record<string, string> = {
  serif: "reading-font-serif",
  sans: "reading-font-sans",
  mono: "reading-font-mono",
}

// ── Flow Text Renderer ─────────────────────────────────────────────────────────
//
// Instead of placing every span absolutely (which causes overflow when the PDF
// viewport is wider than the phone screen), we:
//
//  1. Decode each item's Y position from its transform matrix (PDF space, y=0 at
//     bottom) and X position.
//  2. Sort all items top-to-bottom, left-to-right.
//  3. Group items into "visual lines" by Y proximity (within ½ a line-height).
//  4. Group lines into "paragraphs" by detecting large vertical gaps (> 1.5×
//     median line-height) or significant indentation changes.
//  5. Render each paragraph as a <p> with normal block flow so the browser
//     handles word-wrap, and font-size drives reflow dynamically.

interface FlowTextLayerProps {
  page: PdfPage
  readingFg: string
  fontSize: number
}

interface LineGroup {
  y: number
  items: PdfTextItem[]
  fontSize: number
}

function buildLineGroups(items: PdfTextItem[]): LineGroup[] {
  type Decoded = { item: PdfTextItem; y: number; x: number; fs: number }

  const decoded: Decoded[] = items
    .filter((it) => it.str.trim().length > 0)
    .map((it) => {
      const [, , , scaleY, tx, ty] = it.transform
      return { item: it, y: ty, x: tx, fs: Math.abs(scaleY) }
    })

  if (decoded.length === 0) return []

  // Step 1: compute median body font-size from ALL decoded items FIRST.
  // This gives us a stable reference before any grouping happens.
  const sortedFs = decoded.map((d) => d.fs).sort((a, b) => a - b)
  const medianFs = sortedFs[Math.floor(sortedFs.length / 2)] || 12

  // Step 2: clamp oversized items.
  // Any item whose font-size is more than 1.8× the median is a drop-cap or
  // display glyph. We clamp its `fs` down to medianFs RIGHT HERE so it never
  // reaches the renderer at an inflated size. Single-char tokens get an
  // additional guard: they are placed in their own isolated line group so the
  // drop-cap glyph itself does not merge with the adjacent body text.
  const DROP_CAP_RATIO = 1.8
  for (const d of decoded) {
    if (d.fs > medianFs * DROP_CAP_RATIO) {
      d.fs = medianFs
    }
  }

  // Step 3: sort top-to-bottom (largest PDF y first), then left-to-right.
  decoded.sort((a, b) => b.y - a.y || a.x - b.x)

  // Step 4: group into visual lines.
  // Two items belong to the same line when |Δy| < 50% of their font-size.
  const lines: LineGroup[] = []
  for (const d of decoded) {
    const tolerance = d.fs * 0.5
    const existing = lines.find((l) => Math.abs(l.y - d.y) < tolerance)
    if (existing) {
      existing.items.push(d.item)
      // Keep the line's recorded fontSize at the mode, not the max,
      // so one large glyph can't inflate the whole line's scale.
      existing.fontSize = existing.items.length > 1
        ? existing.fontSize  // keep existing once we have multiple items
        : Math.max(existing.fontSize, d.fs)
    } else {
      lines.push({ y: d.y, items: [d.item], fontSize: d.fs })
    }
  }

  // Step 5: re-sort items within each line left-to-right.
  for (const line of lines) {
    line.items.sort((a, b) => a.transform[4] - b.transform[4])
    // Recalculate line fontSize as the median of its items' font-sizes
    // so a single anomalous glyph can't skew the whole line.
    const itemFs = line.items
      .map((it) => Math.abs(it.transform[3]))
      .filter((fs) => fs > 0)
      .sort((a, b) => a - b)
    if (itemFs.length > 0) {
      line.fontSize = itemFs[Math.floor(itemFs.length / 2)]
      // Clamp again at the item level in case transform values weren't yet seen
      if (line.fontSize > medianFs * DROP_CAP_RATIO) {
        line.fontSize = medianFs
      }
    }
  }

  return lines
}

function FlowTextLayer({ page, readingFg, fontSize }: FlowTextLayerProps) {
  const { items } = page
  if (items.length === 0) return null

  const lines = buildLineGroups(items)
  if (lines.length === 0) return null

  // ── Paragraph detection ────────────────────────────────────────────────────
  //
  // Two signals are used — either one alone is sufficient to start a new <p>:
  //
  //  A) VERTICAL GAP: a gap between consecutive lines that is > 1.5× the
  //     median inter-line gap indicates a blank line separator (rare in novels
  //     but present in chapter headings and section breaks).
  //
  //  B) INDENTATION: in typeset novels every paragraph starts with a first-line
  //     indent. We compute the "common left margin" as the mode of the first
  //     item's X value across all lines (most lines start flush left). Any line
  //     whose first item's X is shifted right by more than ~4% of the page
  //     width (2 PDF units at typical page widths) is treated as an indented
  //     paragraph start.

  // Collect first-item X values for all body lines to find the common margin.
  const firstXValues = lines
    .filter((l) => l.items.length > 0)
    .map((l) => Math.round(l.items[0].transform[4])) // round to nearest integer

  // Mode: find the X value that appears most frequently — that is the flush margin.
  const xFreq: Record<number, number> = {}
  for (const x of firstXValues) xFreq[x] = (xFreq[x] ?? 0) + 1
  const commonMarginX = Number(
    Object.entries(xFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0,
  )

  // Indentation threshold: a line is "indented" if its first item's X is more
  // than 2 PDF units right of the common margin. We use an absolute threshold
  // rather than a ratio so it works across different page sizes.
  const INDENT_THRESHOLD = 2

  // Vertical gap threshold
  const gaps: number[] = []
  for (let i = 1; i < lines.length; i++) {
    gaps.push(Math.abs(lines[i - 1].y - lines[i].y))
  }
  gaps.sort((a, b) => a - b)
  const medianGap = gaps[Math.floor(gaps.length / 2)] ?? 0
  const paraThreshold = medianGap * 1.5

  const isIndented = (line: LineGroup): boolean => {
    if (line.items.length === 0) return false
    const lineX = line.items[0].transform[4]
    return lineX > commonMarginX + INDENT_THRESHOLD
  }

  // Group lines into paragraphs using both signals
  const paragraphs: LineGroup[][] = []
  let current: LineGroup[] = []
  for (let i = 0; i < lines.length; i++) {
    if (i === 0) {
      current.push(lines[i])
      continue
    }
    const verticalBreak = Math.abs(lines[i - 1].y - lines[i].y) > paraThreshold
    const indentBreak = isIndented(lines[i])

    if (verticalBreak || indentBreak) {
      if (current.length > 0) paragraphs.push(current)
      current = []
    }
    current.push(lines[i])
  }
  if (current.length > 0) paragraphs.push(current)

  // All font-sizes in line groups are already clamped to the body range by
  // buildLineGroups. Compute a clean median from the (now-normalized) line
  // font-sizes so we can scale each line relative to the user's target size.
  const allFs = lines.map((l) => l.fontSize).sort((a, b) => a - b)
  const medianBodyFs = allFs[Math.floor(allFs.length / 2)] || 12
  // Tight ceiling: at most 1.35× the user's body font size.
  // This allows chapter headings to be slightly larger but completely prevents
  // any residual drop-cap encoding from producing oversized text.
  const MAX_SCALED_FS = fontSize * 1.35

  return (
    <div
      aria-label="Page text content"
      style={{ userSelect: "text", WebkitUserSelect: "text" }}
    >
      {paragraphs.map((para, pi) => (
        <p
          key={pi}
          style={{
            marginBottom: "1.75rem",
            color: readingFg,
            lineHeight: 1.8,
            wordBreak: "break-word",
            whiteSpace: "pre-wrap",
            overflowWrap: "break-word",
            fontSize: fontSize,
          }}
        >
          {para.map((line, li) => {
            // All line.fontSize values are already body-range. Scale relative
            // to median, then hard-clamp so nothing escapes body size range.
            const ratio = medianBodyFs > 0 ? line.fontSize / medianBodyFs : 1
            const scaledFs = Math.min(ratio * fontSize, MAX_SCALED_FS)
            const text = line.items.map((it) => it.str).join(" ")
            return (
              <span
                key={li}
                style={{
                  display: "inline",
                  fontSize: Math.max(scaledFs, 10),
                }}
              >
                {text}
                {li < para.length - 1 ? " " : ""}
              </span>
            )
          })}
        </p>
      ))}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReadingPane() {
  const {
    pdfPages,
    currentPage,
    totalPages,
    nextPage,
    prevPage,
    renderPage,
    readingBg,
    readingFont,
    fontSize,
    uiVisible,
    toggleUiVisible,
    showUi,
  } = useReader()

  const scrollRef = useRef<HTMLDivElement>(null)
  const lastTapRef = useRef(0)
  const jumpInputRef = useRef<HTMLInputElement>(null)
  const touchStartXRef = useRef(0)
  const touchStartYRef = useRef(0)

  // Page-jump input state
  const [jumpMode, setJumpMode] = useState(false)
  const [jumpValue, setJumpValue] = useState("")

  const openJump = useCallback(() => {
    setJumpValue(String(currentPage))
    setJumpMode(true)
    // Focus the input on the next paint
    requestAnimationFrame(() => jumpInputRef.current?.select())
  }, [currentPage])

  const commitJump = useCallback(() => {
    const target = parseInt(jumpValue, 10)
    if (!isNaN(target) && target >= 1 && target <= totalPages) {
      renderPage(target)
    }
    setJumpMode(false)
  }, [jumpValue, totalPages, renderPage])

  const handleJumpKey = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return
      if (e.key === "Enter") commitJump()
      if (e.key === "Escape") setJumpMode(false)
    },
    [commitJump],
  )

  // Scroll to top whenever page changes
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "instant" })
  }, [currentPage])

  // Always show UI when entering a new page
  useEffect(() => {
    showUi()
  }, [currentPage, showUi])

  // Auto-reveal/hide panels based on scroll direction with buffer zones
  // Prevents glitchy flickering near thresholds by tracking scroll direction
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let previousScrollTop = 0
    
    const handleScroll = () => {
      const currentScrollTop = el.scrollTop
      const isScrollingDown = currentScrollTop > previousScrollTop
      const isScrollingUp = currentScrollTop < previousScrollTop
      
      const atAbsoluteTop = currentScrollTop <= 10
      const atAbsoluteBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 30
      
      // Show UI when at absolute edges
      if (atAbsoluteTop || atAbsoluteBottom) {
        showUi()
      }
      // Hide UI only if scrolled sufficiently away from edges (20px buffer)
      else if (isScrollingDown && previousScrollTop <= 30 && currentScrollTop > 30) {
        // Scrolling down from top — hide after 20px buffer
        if (uiVisible) toggleUiVisible()
      } else if (isScrollingUp && previousScrollTop >= el.scrollHeight - 50 && currentScrollTop < el.scrollHeight - 50) {
        // Scrolling up from bottom — hide after 20px buffer
        if (uiVisible) toggleUiVisible()
      }
      
      previousScrollTop = currentScrollTop
    }
    
    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => el.removeEventListener("scroll", handleScroll)
  }, [currentPage, showUi, uiVisible, toggleUiVisible])

  // Swipe gesture handlers for page navigation
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = e.touches[0].clientX
    touchStartYRef.current = e.touches[0].clientY
  }, [])

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      const touchEndX = e.changedTouches[0].clientX
      const touchEndY = e.changedTouches[0].clientY
      const deltaX = touchStartXRef.current - touchEndX
      const deltaY = Math.abs(touchStartYRef.current - touchEndY)

      // Minimum swipe distance threshold (50px)
      const SWIPE_THRESHOLD = 50
      
      // Ignore if vertical movement is too large (vertical scrolling, not swiping)
      if (deltaY > SWIPE_THRESHOLD) return
      
      // Swipe left (deltaX positive) = next page
      if (deltaX > SWIPE_THRESHOLD) {
        nextPage()
      }
      // Swipe right (deltaX negative) = prev page
      else if (deltaX < -SWIPE_THRESHOLD) {
        prevPage()
      }
    },
    [nextPage, prevPage],
  )

  // Single-tap handler: toggle UI; ignore double-taps and interactive children
  const handleTap = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest("button,a,input,select,textarea")) return
      const now = Date.now()
      if (now - lastTapRef.current < 300) {
        lastTapRef.current = 0
        return
      }
      lastTapRef.current = now
      toggleUiVisible()
    },
    [toggleUiVisible],
  )

  const page = pdfPages[currentPage - 1]
  const readingFg = "var(--reading-fg)"

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Reading toolbar — slides down when visible */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: uiVisible ? "80px" : "0px", opacity: uiVisible ? 1 : 0 }}
        aria-hidden={!uiVisible}
      >
        <ReadingToolbar />
      </div>

      {/* Scrollable reading area */}
      <div
        ref={scrollRef}
        className={`reading-pane flex-1 overflow-y-auto overflow-x-hidden ${BG_CLASS[readingBg]} ${FONT_CLASS[readingFont]}`}
        style={{ backgroundColor: "var(--reading-bg)", color: "var(--reading-fg)" }}
        onClick={handleTap}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        role="main"
        aria-label="Reading area"
      >
        {/* Text content — full width, reflowing block layout */}
        <div className="w-full max-w-full px-5 pt-6 pb-28 overflow-x-hidden">
          {page ? (
            <FlowTextLayer
              page={page}
              readingFg={readingFg}
              fontSize={fontSize}
            />
          ) : null}

          {page && page.items.length === 0 && (
            <p
              className="text-center py-16 text-sm"
              style={{ color: "color-mix(in oklch, var(--reading-fg) 50%, transparent)" }}
            >
              This page appears to be image-only and has no selectable text.
            </p>
          )}
        </div>

        {/* Bottom navigation — slides up when visible */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 transition-all duration-300 ease-in-out"
          style={{
            transform: uiVisible ? "translateY(0)" : "translateY(100%)",
            opacity: uiVisible ? 1 : 0,
            pointerEvents: uiVisible ? "auto" : "none",
          }}
          aria-label="Page navigation"
          aria-hidden={!uiVisible}
        >
          <div
            className="max-w-2xl mx-auto flex items-center justify-between gap-2 px-4 py-3 border-t"
            style={{
              backgroundColor: "var(--reading-bg)",
              borderColor: "color-mix(in oklch, var(--reading-fg) 15%, transparent)",
            }}
          >
            <button
              onClick={prevPage}
              disabled={currentPage <= 1}
              className="flex items-center gap-1.5 px-5 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 touch-manipulation disabled:opacity-30"
              style={{
                backgroundColor: "color-mix(in oklch, var(--reading-fg) 10%, transparent)",
                color: "var(--reading-fg)",
              }}
              aria-label="Go to previous page"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              Prev
            </button>

            {jumpMode ? (
              <input
                ref={jumpInputRef}
                type="number"
                inputMode="numeric"
                min={1}
                max={totalPages}
                value={jumpValue}
                onChange={(e) => setJumpValue(e.target.value)}
                onKeyDown={handleJumpKey}
                onBlur={commitJump}
                autoFocus
                className="w-20 text-center text-xs font-medium tabular-nums rounded-lg px-2 py-1 border focus:outline-none"
                style={{
                  backgroundColor: "color-mix(in oklch, var(--reading-fg) 8%, transparent)",
                  borderColor: "color-mix(in oklch, var(--reading-fg) 25%, transparent)",
                  color: "var(--reading-fg)",
                }}
                aria-label="Jump to page number"
              />
            ) : (
              <button
                onClick={openJump}
                className="px-3 py-1.5 rounded-lg text-xs font-medium tabular-nums active:scale-95 transition-transform touch-manipulation"
                style={{ color: "color-mix(in oklch, var(--reading-fg) 60%, transparent)" }}
                aria-label={`Page ${currentPage} of ${totalPages}. Tap to jump to a page.`}
                aria-live="polite"
              >
                {currentPage} / {totalPages}
              </button>
            )}

            <button
              onClick={nextPage}
              disabled={currentPage >= totalPages}
              className="flex items-center gap-1.5 px-5 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 touch-manipulation disabled:opacity-30"
              style={{
                backgroundColor: "color-mix(in oklch, var(--reading-fg) 10%, transparent)",
                color: "var(--reading-fg)",
              }}
              aria-label="Go to next page"
            >
              Next
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </nav>
      </div>
    </div>
  )
}
