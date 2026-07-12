"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useReader, type PdfPage, type PdfTextItem } from "./ReaderContext"
import {
  saveBook,
  loadBookBlob,
  getBookmark,
  makeBookId,
  listBooks,
  saveParsedPages,
  loadParsedPages,
} from "./useBookStorage"
import { serializePages, deserializePages } from "./pageSerializer"

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
  const readerContext = useReader()
  const loadBookRef = useRef(readerContext.loadBook)
  useEffect(() => {
    loadBookRef.current = readerContext.loadBook
  }, [readerContext.loadBook])
  
  const [isLoading, setIsLoading] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)  // Default to showing library, only set true if restoring
  const [error, setError] = useState<string | null>(null)

  // On mount: immediately show library, then try to restore in background if there's one book
  useEffect(() => {
    let cancelled = false
    
    // Try to restore in background (non-blocking so library shows immediately)
    ;(async () => {
      try {
        const books = await listBooks()
        if (cancelled || books.length !== 1) return
        
        const meta = books[0]
        const startPage = getBookmark(meta.id)
        
        // Try cache first for fast restore
        try {
          const cachedSerialized = await loadParsedPages(meta.id)
          if (cancelled) return
          
          if (cachedSerialized && cachedSerialized.length > 0) {
            const pages = deserializePages(cachedSerialized)
            loadBookRef.current(pages, meta.title, meta.id, startPage)
            return
          }
        } catch (cacheErr) {
          console.warn("[v0] Cache restore failed:", cacheErr)
        }
        
        // Parse from blob if cache miss
        const blob = await loadBookBlob(meta.id)
        if (cancelled || !blob) return
        
        const pages = await parsePdfFile(blob)
        if (cancelled) return
        
        loadBookRef.current(pages, meta.title, meta.id, startPage)
        
        // Save to cache for next time
        try {
          const serialized = serializePages(pages)
          await saveParsedPages(meta.id, serialized)
        } catch (e) {
          console.warn("[v0] Cache save failed:", e)
        }
      } catch (err) {
        console.warn("[v0] Background restore error:", err)
      }
    })()
    
    return () => {
      cancelled = true
    }
  }, [])

  /** Open a specific book from the library by id */
  const openBookById = useCallback(
    async (id: string, title: string) => {
      setIsLoading(true)
      setError(null)
      try {
        const startPage = getBookmark(id)
        
        // Try to load from cache first (cache hit)
        try {
          const cachedSerialized = await loadParsedPages(id)
          if (cachedSerialized && cachedSerialized.length > 0) {
            const pages = deserializePages(cachedSerialized)
            loadBookRef.current(pages, title, id, startPage)
            return
          }
        } catch (cacheErr) {
          console.warn("[v0] Cache load error, falling back to parsing:", cacheErr)
          // Fall through to parse from blob
        }
        
        // Cache miss or error: parse PDF and save to cache
        const blob = await loadBookBlob(id)
        if (!blob) throw new Error("Book not found in storage.")
        const pages = await parsePdfFile(blob)
        
        // Save parsed pages to cache for future loads
        try {
          const serialized = serializePages(pages)
          await saveParsedPages(id, serialized)
        } catch (cacheErr) {
          console.warn("[v0] Cache save error, continuing anyway:", cacheErr)
          // Non-fatal: app still works without cache
        }
        
        loadBookRef.current(pages, title, id, startPage)
      } catch (err) {
        console.error("[v0] Open book error:", err)
        setError("Failed to open book. Please re-upload it.")
      } finally {
        setIsLoading(false)
      }
    },
    [],
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
        console.log("[v0] Book saved successfully, id:", id)
        
        // Cache the parsed pages for future loads (non-fatal if fails)
        try {
          const serialized = serializePages(pages)
          await saveParsedPages(id, serialized)
          console.log("[v0] Parsed pages cached successfully")
        } catch (cacheErr) {
          console.warn("[v0] Cache save error on upload, continuing anyway:", cacheErr)
        }
        
        loadBookRef.current(pages, file.name.replace(/\.pdf$/i, ""), id, 1)
      } catch (err) {
        console.error("[v0] PDF parsing error:", err)
        setError("Failed to load PDF. Please try a different file.")
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  return { loadFile, openBookById, isLoading, isRestoring, error }
}
