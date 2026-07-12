"use client"

import { Type } from "lucide-react"
import { useReader, type ReadingBg, type ReadingFont } from "./ReaderContext"

const BG_OPTIONS: { value: ReadingBg; label: string; swatch: string }[] = [
  { value: "white", label: "White", swatch: "#ffffff" },
  { value: "sepia", label: "Sepia", swatch: "#f3ead8" },
  { value: "dark", label: "Dark", swatch: "#1c1b1a" },
]

const FONT_OPTIONS: { value: ReadingFont; label: string }[] = [
  { value: "serif", label: "Serif" },
  { value: "sans", label: "Sans" },
  { value: "mono", label: "Mono" },
]

export function ReadingToolbar() {
  const { readingBg, setReadingBg, readingFont, setReadingFont, fontSize, increaseFontSize, decreaseFontSize } =
    useReader()

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-b border-border bg-card/90 backdrop-blur-sm">
      {/* Background swatches */}
      <div className="flex items-center gap-1.5" role="group" aria-label="Reading background">
        {BG_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setReadingBg(opt.value)}
            className={`size-6 rounded-full border-2 transition-all active:scale-90 touch-manipulation ${
              readingBg === opt.value ? "border-primary scale-110 shadow-sm" : "border-border"
            }`}
            style={{ backgroundColor: opt.swatch }}
            aria-label={`${opt.label} background`}
            aria-pressed={readingBg === opt.value}
          />
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-border shrink-0" aria-hidden="true" />

      {/* Font family selector */}
      <div className="flex items-center gap-1" role="group" aria-label="Font family">
        <Type className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
        {FONT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setReadingFont(opt.value)}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-all active:scale-95 touch-manipulation ${
              readingFont === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
            aria-label={`${opt.label} font`}
            aria-pressed={readingFont === opt.value}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-border shrink-0" aria-hidden="true" />

      {/* Font size controls */}
      <div className="flex items-center gap-1.5" role="group" aria-label="Font size controls">
        <button
          onClick={decreaseFontSize}
          className="size-7 flex items-center justify-center rounded-lg bg-muted text-muted-foreground font-bold text-sm active:scale-95 transition-all hover:text-foreground touch-manipulation"
          aria-label="Decrease font size"
        >
          A-
        </button>
        <span className="text-xs text-muted-foreground w-8 text-center tabular-nums" aria-live="polite" aria-label={`Font size ${fontSize}`}>
          {fontSize}px
        </span>
        <button
          onClick={increaseFontSize}
          className="size-7 flex items-center justify-center rounded-lg bg-muted text-muted-foreground font-bold text-sm active:scale-95 transition-all hover:text-foreground touch-manipulation"
          aria-label="Increase font size"
        >
          A+
        </button>
      </div>
    </div>
  )
}
