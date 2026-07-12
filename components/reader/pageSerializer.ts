/**
 * Serializes and deserializes PdfPage objects to/from a cache-friendly format.
 * This allows us to cache the heavy PDF parsing work without storing raw PDF data.
 */

import type { PdfPage, PdfTextItem } from "./ReaderContext"

/**
 * Serialize a PdfPage to a JSON string for caching.
 * Includes all necessary data to recreate the page during rendering.
 */
export function serializePage(page: PdfPage): string {
  return JSON.stringify({
    items: page.items,
    viewportWidth: page.viewportWidth,
    viewportHeight: page.viewportHeight,
  })
}

/**
 * Deserialize a cached page string back to a PdfPage object.
 */
export function deserializePage(serialized: string): PdfPage {
  const data = JSON.parse(serialized)
  return {
    items: data.items as PdfTextItem[],
    viewportWidth: data.viewportWidth as number,
    viewportHeight: data.viewportHeight as number,
  }
}

/**
 * Serialize an array of pages for batch caching.
 */
export function serializePages(pages: PdfPage[]): string[] {
  return pages.map(serializePage)
}

/**
 * Deserialize a batch of cached pages.
 */
export function deserializePages(serialized: string[]): PdfPage[] {
  return serialized.map(deserializePage)
}
