"use client"

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react"
import { saveBookmark } from "./useBookStorage"

export type ReadingBg = "white" | "dark" | "sepia"
export type ReadingFont = "serif" | "sans" | "mono"

// One text item straight from PDF.js, including the full transform matrix
export interface PdfTextItem {
  str: string
  // The 6-element transform from PDF.js: [scaleX, skewX, skewY, scaleY, tx, ty]
  transform: [number, number, number, number, number, number]
  width: number
  height: number
  fontName: string
}

export interface PdfPage {
  items: PdfTextItem[]
  viewportWidth: number
  viewportHeight: number
}

interface ReaderState {
  // Global
  globalDark: boolean
  toggleGlobalDark: () => void

  // Active book
  activeBookId: string
  pdfPages: PdfPage[]
  pdfName: string
  totalPages: number
  currentPage: number
  /** Load a parsed book into the reader */
  loadBook: (pages: PdfPage[], name: string, bookId: string, startPage?: number) => void
  /** Return to the library (close the active book) */
  closeBook: () => void
  goToPage: (page: number) => void
  /** Jump directly to a specific page number (alias for goToPage, used by page-jump input) */
  renderPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void

  // Immersive UI visibility (tap-to-toggle)
  uiVisible: boolean
  toggleUiVisible: () => void
  showUi: () => void

  // Reading pane customization
  readingBg: ReadingBg
  setReadingBg: (bg: ReadingBg) => void
  readingFont: ReadingFont
  setReadingFont: (font: ReadingFont) => void
  fontSize: number
  increaseFontSize: () => void
  decreaseFontSize: () => void
}

const ReaderContext = createContext<ReaderState | null>(null)

export function ReaderProvider({ children }: { children: ReactNode }) {
  const [globalDark, setGlobalDark] = useState(true)
  const [activeBookId, setActiveBookId] = useState("")
  const [pdfPages, setPdfPages] = useState<PdfPage[]>([])
  const [pdfName, setPdfName] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [uiVisible, setUiVisible] = useState(true)
  const [readingBg, setReadingBg] = useState<ReadingBg>("dark")
  const [readingFont, setReadingFont] = useState<ReadingFont>("serif")
  const [fontSize, setFontSize] = useState(17)

  const toggleGlobalDark = useCallback(() => setGlobalDark((v) => !v), [])

  const loadBook = useCallback(
    (pages: PdfPage[], name: string, bookId: string, startPage = 1) => {
      setPdfPages(pages)
      setPdfName(name)
      setActiveBookId(bookId)
      setCurrentPage(Math.min(Math.max(startPage, 1), pages.length))
      setUiVisible(true)
    },
    [],
  )

  const closeBook = useCallback(() => {
    setPdfPages([])
    setPdfName("")
    setActiveBookId("")
    setCurrentPage(1)
    setUiVisible(true)
  }, [])

  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(page)
      setActiveBookId((id) => {
        if (id) saveBookmark(id, page)
        return id
      })
    },
    [],
  )

  const nextPage = useCallback(() => {
    setCurrentPage((p) => {
      const next = Math.min(p + 1, pdfPages.length)
      setActiveBookId((id) => {
        if (id) saveBookmark(id, next)
        return id
      })
      return next
    })
  }, [pdfPages.length])

  const prevPage = useCallback(() => {
    setCurrentPage((p) => {
      const prev = Math.max(p - 1, 1)
      setActiveBookId((id) => {
        if (id) saveBookmark(id, prev)
        return id
      })
      return prev
    })
  }, [])

  const toggleUiVisible = useCallback(() => setUiVisible((v) => !v), [])
  const showUi = useCallback(() => setUiVisible(true), [])

  const increaseFontSize = useCallback(
    () => setFontSize((s) => Math.min(s + 1, 28)),
    [],
  )
  const decreaseFontSize = useCallback(
    () => setFontSize((s) => Math.max(s - 1, 12)),
    [],
  )

  return (
    <ReaderContext.Provider
      value={{
        globalDark,
        toggleGlobalDark,
        activeBookId,
        pdfPages,
        pdfName,
        totalPages: pdfPages.length,
        currentPage,
        loadBook,
        closeBook,
        goToPage,
        renderPage: goToPage,
        nextPage,
        prevPage,
        uiVisible,
        toggleUiVisible,
        showUi,
        readingBg,
        setReadingBg,
        readingFont,
        setReadingFont,
        fontSize,
        increaseFontSize,
        decreaseFontSize,
      }}
    >
      {children}
    </ReaderContext.Provider>
  )
}

export function useReader() {
  const ctx = useContext(ReaderContext)
  if (!ctx) throw new Error("useReader must be used within ReaderProvider")
  return ctx
}
