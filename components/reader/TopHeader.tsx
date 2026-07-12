"use client"

import { useEffect, useState } from "react"
import { BookOpen, Moon, Sun, ChevronLeft } from "lucide-react"
import { useReader } from "./ReaderContext"

interface TopHeaderProps {
  onFileLoad: (file: File) => void
  isLoading: boolean
  /** Whether a book is currently open in the reader */
  hasBook: boolean
  /** Called when the user taps the back-to-library button */
  onBack: () => void
}

export function TopHeader({ onFileLoad, isLoading, hasBook, onBack }: TopHeaderProps) {
  const [mounted, setMounted] = useState(false)
  const {
    globalDark,
    toggleGlobalDark,
    pdfName,
    totalPages,
    currentPage,
    uiVisible,
  } = useReader()
  
  useEffect(() => {
    setMounted(true)
  }, [])
  // Library screen has no top header — branding / dark toggle live in the dashboard
  if (!hasBook) return null

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 border-b border-border bg-card/95 backdrop-blur-sm transition-all duration-300 ease-in-out"
      style={
        hasBook
          ? {
              maxHeight: uiVisible ? "56px" : "0px",
              opacity: uiVisible ? 1 : 0,
              overflow: "hidden",
              borderBottomWidth: uiVisible ? "1px" : "0px",
              pointerEvents: uiVisible ? "auto" : "none",
            }
          : undefined
      }
      aria-hidden={hasBook && !uiVisible}
    >
      {/* Left side */}
      <div className="flex items-center gap-2 min-w-0">
        {hasBook ? (
          /* Back to library button */
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-2 py-1.5 -ml-1 rounded-lg hover:bg-muted active:scale-95 transition-transform touch-manipulation text-muted-foreground"
            aria-label="Back to library"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            <span className="text-xs font-medium">Library</span>
          </button>
        ) : (
          /* Brand mark */
          <div className="flex items-center gap-2">
            <BookOpen className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-sm font-semibold leading-tight">NovelRead</p>
          </div>
        )}

        {/* Book title + page indicator (reading mode only) */}
        {hasBook && pdfName && (
          <div className="min-w-0 ml-1 border-l border-border pl-3">
            <p className="text-sm font-semibold truncate max-w-[140px] leading-tight">
              {pdfName}
            </p>
            {totalPages > 0 && (
              <p className="text-[10px] text-muted-foreground leading-tight tabular-nums">
                {currentPage} / {totalPages}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={toggleGlobalDark}
          className="p-2 rounded-lg hover:bg-muted active:scale-95 transition-transform touch-manipulation"
          aria-label={mounted ? (globalDark ? "Switch to light mode" : "Switch to dark mode") : "Theme toggle"}
          suppressHydrationWarning
        >
          {mounted && (
            globalDark ? (
              <Sun className="size-4 text-muted-foreground" aria-hidden="true" />
            ) : (
              <Moon className="size-4 text-muted-foreground" aria-hidden="true" />
            )
          )}
        </button>
      </div>
    </header>
  )
}
