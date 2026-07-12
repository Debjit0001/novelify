"use client"

import { useEffect, useRef, useState } from "react"
import { useReader } from "./ReaderContext"
import { TopHeader } from "./TopHeader"
import { LibraryDashboard } from "./LibraryDashboard"
import { ReadingPane } from "./ReadingPane"
import { usePdfLoader } from "./PdfLoader"
import { AlertCircle, Loader2 } from "lucide-react"

export function ReaderApp() {
  const { globalDark, pdfPages, closeBook } = useReader()
  const { loadFile, openBookById, isLoading, isRestoring, error } = usePdfLoader()
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasBook = pdfPages.length > 0

  // Apply global dark class to root (starts in dark mode by default)
  useEffect(() => {
    const html = document.documentElement
    if (globalDark) html.classList.add("dark")
    else html.classList.remove("dark")
  }, [globalDark])
  
  // Initialize with dark class on mount
  useEffect(() => {
    document.documentElement.classList.add("dark")
  }, [])

  // Register service worker for offline support and PWA installation
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("[v0] Service Worker registered successfully:", registration.scope)
        })
        .catch((err) => {
          console.error("[v0] Service Worker registration failed:", err)
        })
    }
  }, [])

  // Capture PWA install prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
      setShowInstallBanner(true)
    }
    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    // @ts-expect-error — non-standard prompt()
    await installPrompt.prompt()
    setShowInstallBanner(false)
    setInstallPrompt(null)
  }

  // Triggered from LibraryDashboard's "Add Book" button
  const triggerUpload = () => fileInputRef.current?.click()

  // Restoring splash
  if (isRestoring) {
    return (
      <div className="flex flex-col items-center justify-center h-dvh max-w-2xl mx-auto bg-background gap-4">
        <Loader2 className="size-8 text-primary animate-spin" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Loading your library…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-dvh max-w-2xl mx-auto bg-background overflow-hidden">
      {/* PWA install banner */}
      {showInstallBanner && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-2.5 bg-primary text-primary-foreground text-sm"
          role="banner"
        >
          <span className="font-medium">Add NovelRead to your home screen</span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleInstall}
              className="px-3 py-1 rounded-lg bg-primary-foreground text-primary font-semibold text-xs active:scale-95 transition-transform touch-manipulation"
            >
              Install
            </button>
            <button
              onClick={() => setShowInstallBanner(false)}
              className="px-2 py-1 rounded-lg opacity-70 hover:opacity-100 text-xs touch-manipulation"
              aria-label="Dismiss install prompt"
            >
              &#x2715;
            </button>
          </div>
        </div>
      )}

      {/* Hidden shared file input — used by both TopHeader and LibraryDashboard */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="sr-only"
        aria-label="Upload PDF file"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) loadFile(file)
          e.target.value = ""
        }}
      />

      {/* Sticky top header */}
      <TopHeader
        onFileLoad={loadFile}
        isLoading={isLoading}
        hasBook={hasBook}
        onBack={closeBook}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div
          className="flex-1 flex flex-col items-center justify-center gap-4 px-6"
          role="status"
          aria-label="Loading PDF"
        >
          <Loader2 className="size-10 text-primary animate-spin" aria-hidden="true" />
          <p className="text-sm text-muted-foreground font-medium">Extracting pages…</p>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            This may take a moment for larger books
          </p>
        </div>
      )}

      {/* Error state */}
      {!isLoading && error && (
        <div
          className="flex-1 flex flex-col items-center justify-center gap-4 px-6"
          role="alert"
        >
          <div className="size-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold mb-1">Something went wrong</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <button
            onClick={triggerUpload}
            className="mt-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm active:scale-95 transition-transform touch-manipulation"
          >
            Try another file
          </button>
        </div>
      )}

      {/* Library dashboard (shown when no book is active) */}
      {!isLoading && !error && !hasBook && (
        <LibraryDashboard
          onOpenBook={openBookById}
          onUploadRequest={triggerUpload}
          isOpening={isLoading}
        />
      )}

      {/* Reading pane */}
      {!isLoading && !error && hasBook && <ReadingPane />}
    </div>
  )
}
