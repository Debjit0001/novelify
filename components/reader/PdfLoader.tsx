"use client"

import { useState, useCallback, useEffect } from "react"
import { useReader, type PdfPage, type PdfTextItem } from "./ReaderContext"
import {
  saveBook,
  loadBookBlob,
  getBookmark,
  makeBookId,
  listBooks,
} from "./useBookStorage"

// ── PDF Parsing ───────────────────────────────────────────────────────────────

/**
 * Parse a PDF File/Blob into an array of PdfPage objects.
 * Each page contains the raw PDF.js text items with their full transform matrices,
 * viewport dimensions, and font info — no heuristic text merging is done here.
 * The ReadingPane component is responsible for placing items on screen.
 */
export async function parsePdfFile(file: File | Blob): Promise<PdfPage[]> {
  const pdfjsLib = await import("pdfjs-dist")
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString()

  const arrayBuffer = await (file as File).arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const pages: PdfPage[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 1 })
    const textContent = await page.getTextContent()

    const items: PdfTextItem[] = textContent.items
      .filter(
        (item): item is typeof item & { str: string; transform: number[] } =>
          "str" in item &&
          typeof (item as { str: unknown }).str === "string" &&
          ((item as { str: string }).str.trim() !== "" ||
            (item as { hasEOL?: boolean }).hasEOL === true),
      )
      .map((item) => {
        const it = item as {
          str: string
          transform: number[]
          width: number
          height: number
          fontName: string
          hasEOL?: boolean
        }
        // PDF.js transform: [scaleX, skewX, skewY, scaleY, tx, ty]
        // ty is bottom-up from PDF origin; we keep it as-is — the renderer will flip.
        return {
          str: it.str,
          transform: it.transform as PdfTextItem["transform"],
          width: it.width,
          height: it.height > 0 ? it.height : Math.abs(it.transform[3]),
          fontName: it.fontName ?? "",
        }
      })

    pages.push({
      items,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
    })
  }

  return pages
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePdfLoader() {
  const { loadBook } = useReader()
  const [isLoading, setIsLoading] = useState(false)
  const [isRestoring, setIsRestoring] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // On mount: if there's exactly one saved book (and user was reading it),
  // auto-restore it so the reader opens immediately.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const books = await listBooks()
        // Only auto-restore if there is exactly one book; otherwise show library
        if (books.length === 1) {
          const meta = books[0]
          const blob = await loadBookBlob(meta.id)
          if (blob && !cancelled) {
            const startPage = getBookmark(meta.id)
            const pages = await parsePdfFile(blob)
            if (!cancelled) loadBook(pages, meta.title, meta.id, startPage)
          }
        }
      } catch {
        // Silently ignore — user can pick from the library
      } finally {
        if (!cancelled) setIsRestoring(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadBook])

  /** Open a specific book from the library by id */
  const openBookById = useCallback(
    async (id: string, title: string) => {
      setIsLoading(true)
      setError(null)
      try {
        const blob = await loadBookBlob(id)
        if (!blob) throw new Error("Book not found in storage.")
        const startPage = getBookmark(id)
        const pages = await parsePdfFile(blob)
        loadBook(pages, title, id, startPage)
      } catch (err) {
        console.error("[v0] Open book error:", err)
        setError("Failed to open book. Please re-upload it.")
      } finally {
        setIsLoading(false)
      }
    },
    [loadBook],
  )

  /** Upload a new PDF file, save to IDB, and open it */
  const loadFile = useCallback(
    async (file: File) => {
      if (file.type !== "application/pdf") {
        setError("Please upload a valid PDF file.")
        return
      }
      setIsLoading(true)
      setError(null)

      try {
        // Parse first so we know the page count before saving
        const pages = await parsePdfFile(file)
        const id = makeBookId(file)
        await saveBook(file, pages.length)
        loadBook(pages, file.name.replace(/\.pdf$/i, ""), id, 1)
      } catch (err) {
        console.error("[v0] PDF parsing error:", err)
        setError("Failed to load PDF. Please try a different file.")
      } finally {
        setIsLoading(false)
      }
    },
    [loadBook],
  )

  return { loadFile, openBookById, isLoading, isRestoring, error }
}
