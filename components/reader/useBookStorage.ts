"use client"

import { get, set, del, keys } from "idb-keyval"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BookMeta {
  id: string          // derived from file name + size (stable across re-uploads)
  title: string       // file name sans extension
  totalPages: number  // filled in after parsing
  addedAt: number     // Date.now() at time of upload
}

// IDB keys: "book_blob_<id>" for blobs, "book_meta_<id>" for metadata, "book_parsed_<id>" for cached parsed pages
const metaKey   = (id: string) => `book_meta_${id}`
const blobKey   = (id: string) => `book_blob_${id}`
const parsedKey = (id: string) => `book_parsed_${id}`

const LS_BOOKMARKS_KEY = "novelread_bookmarks"  // { [id]: page }

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generate a stable ID from a file's name + size */
export function makeBookId(file: File): string {
  // Simple but stable: slug the name + append the byte length
  const slug = file.name
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40)
  return `${slug}-${file.size}`
}

// ── Multi-book Library API ────────────────────────────────────────────────────

/** List all stored book metadata, sorted newest-first */
export async function listBooks(): Promise<BookMeta[]> {
  try {
    const allKeys = await keys()
    const metaKeys = (allKeys as string[]).filter((k) => k.startsWith("book_meta_"))
    const metas = await Promise.all(metaKeys.map((k) => get<BookMeta>(k)))
    return (metas.filter(Boolean) as BookMeta[]).sort((a, b) => b.addedAt - a.addedAt)
  } catch {
    return []
  }
}

/** Save a book's blob and initial metadata; returns the book id */
export async function saveBook(file: File, totalPages: number): Promise<string> {
  const id = makeBookId(file)
  const title = file.name.replace(/\.pdf$/i, "")
  const meta: BookMeta = { id, title, totalPages, addedAt: Date.now() }
  await set(blobKey(id), file)
  await set(metaKey(id), meta)
  return id
}

/** Retrieve a book's raw blob by id */
export async function loadBookBlob(id: string): Promise<File | null> {
  try {
    const stored = await get<File>(blobKey(id))
    return stored ?? null
  } catch {
    return null
  }
}

/** Delete a book and its metadata from IDB (and its bookmark from LS and parsed cache) */
export async function deleteBook(id: string): Promise<void> {
  await del(blobKey(id))
  await del(metaKey(id))
  await del(parsedKey(id))  // Clear parsed pages cache
  const bookmarks = loadAllBookmarks()
  delete bookmarks[id]
  saveAllBookmarks(bookmarks)
}

/** Save cached parsed pages (array of formatted HTML strings) for a book */
export async function saveParsedPages(id: string, parsedPages: string[]): Promise<void> {
  await set(parsedKey(id), parsedPages)
}

/** Load cached parsed pages for a book (returns null if cache miss) */
export async function loadParsedPages(id: string): Promise<string[] | null> {
  try {
    const cached = await get<string[]>(parsedKey(id))
    return cached ?? null
  } catch {
    return null
  }
}

// ── Bookmark API ──────────────────────────────────────────────────────────────

function loadAllBookmarks(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LS_BOOKMARKS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveAllBookmarks(bookmarks: Record<string, number>): void {
  localStorage.setItem(LS_BOOKMARKS_KEY, JSON.stringify(bookmarks))
}

/** Get the last-read page for a book (defaults to 1) */
export function getBookmark(id: string): number {
  const bookmarks = loadAllBookmarks()
  const n = bookmarks[id]
  return typeof n === "number" && n >= 1 ? n : 1
}

/** Persist the current page for a specific book */
export function saveBookmark(id: string, page: number): void {
  const bookmarks = loadAllBookmarks()
  bookmarks[id] = page
  saveAllBookmarks(bookmarks)
}
