"use client"

import { useEffect, useState, useCallback } from "react"
import { BookOpen, Plus, Trash2, BookMarked, Loader2, Moon, Sun } from "lucide-react"
import { listBooks, deleteBook, getBookmark, type BookMeta } from "./useBookStorage"
import { useReader } from "./ReaderContext"

interface LibraryDashboardProps {
  onOpenBook: (id: string, title: string) => void
  onUploadRequest: () => void
  isOpening: boolean
}

export function LibraryDashboard({
  onOpenBook,
  onUploadRequest,
  isOpening,
}: LibraryDashboardProps) {
  const { globalDark, toggleGlobalDark } = useReader()
  const [books, setBooks] = useState<BookMeta[]>([])
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [mounted, setMounted] = useState(false)

  const refresh = useCallback(async () => {
    const metas = await listBooks()
    setBooks(metas)
    setLoaded(true)
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleOpen = async (book: BookMeta) => {
    if (loadingId) return
    setLoadingId(book.id)
    await onOpenBook(book.id, book.title)
    setLoadingId(null)
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (deletingId) return
    setDeletingId(id)
    await deleteBook(id)
    await refresh()
    setDeletingId(null)
  }

  const bookmarkFor = (id: string) => getBookmark(id)

  return (
    <main className="relative flex-1 overflow-y-auto" aria-label="Book library">
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-28">

        {/* Page title row — always visible */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-lg font-bold tracking-tight text-foreground">My Library</h1>
          <button
            onClick={toggleGlobalDark}
            className="p-2 rounded-xl hover:bg-muted active:scale-95 transition-transform touch-manipulation"
            aria-label={mounted ? (globalDark ? "Switch to light mode" : "Switch to dark mode") : "Theme toggle"}
            suppressHydrationWarning
          >
            {mounted && (
              globalDark ? (
                <Sun className="size-5 text-muted-foreground" aria-hidden="true" />
              ) : (
                <Moon className="size-5 text-muted-foreground" aria-hidden="true" />
              )
            )}
          </button>
        </div>

        {/* Content */}
        {!loaded ? (
          <div className="flex justify-center py-20">
            <Loader2 className="size-7 text-primary animate-spin" aria-hidden="true" />
          </div>
        ) : books.length === 0 ? (
          /* Empty library */
          <div className="flex flex-col items-center justify-center py-16 gap-5 text-center">
            <div className="size-20 rounded-2xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="size-10 text-primary" aria-hidden="true" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground mb-1">No books yet</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Tap the button below to upload a PDF. Your library is stored locally on this device.
              </p>
            </div>
          </div>
        ) : (
          /* Book grid */
          <ul
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
            aria-label="Saved books"
          >
            {books.map((book) => {
              const page = bookmarkFor(book.id)
              const progress = book.totalPages > 0
                ? Math.round((page / book.totalPages) * 100)
                : 0
              const isThisOpening = loadingId === book.id
              const isThisDeleting = deletingId === book.id

              return (
                <li key={book.id}>
                  <button
                    onClick={() => handleOpen(book)}
                    disabled={!!loadingId || isOpening}
                    className="relative w-full text-left rounded-2xl border border-border bg-card overflow-hidden active:scale-[0.97] transition-transform touch-manipulation group disabled:opacity-60"
                    aria-label={`Open ${book.title}, page ${page} of ${book.totalPages}`}
                  >
                    {/* Book "cover" area */}
                    <div
                      className="aspect-[2/3] w-full flex flex-col items-center justify-center gap-2 p-4"
                      style={{ background: coverGradient(book.id) }}
                    >
                      {isThisOpening ? (
                        <Loader2 className="size-8 text-white animate-spin" aria-hidden="true" />
                      ) : (
                        <BookMarked className="size-10 text-white/90 drop-shadow" aria-hidden="true" />
                      )}
                    </div>

                    {/* Info area */}
                    <div className="px-3 py-2.5">
                      <p className="text-sm font-semibold text-card-foreground leading-snug line-clamp-2 mb-1">
                        {book.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {book.totalPages} pages
                      </p>

                      {/* Progress bar */}
                      <div className="mt-2 h-1 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${progress}%` }}
                          role="progressbar"
                          aria-valuenow={progress}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${progress}% read`}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {progress}% &middot; p.{page}
                      </p>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => handleDelete(e, book.id)}
                      disabled={isThisDeleting || !!deletingId}
                      className="absolute top-2 right-2 size-7 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 active:scale-95 transition-all touch-manipulation"
                      aria-label={`Delete ${book.title}`}
                    >
                      {isThisDeleting ? (
                        <Loader2 className="size-3.5 text-white animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 className="size-3.5 text-white" aria-hidden="true" />
                      )}
                    </button>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Floating Action Button — add new book */}
      <button
        onClick={onUploadRequest}
        disabled={isOpening}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-90 transition-transform touch-manipulation disabled:opacity-50"
        aria-label="Add a new book"
      >
        <Plus className="size-6" aria-hidden="true" />
      </button>
    </main>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Generate a deterministic warm gradient for a book cover from its id string */
function coverGradient(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) & 0xffff
  }
  const h1 = hash % 360
  const h2 = (h1 + 30) % 360
  return `linear-gradient(145deg, oklch(0.45 0.15 ${h1}), oklch(0.3 0.12 ${h2}))`
}
