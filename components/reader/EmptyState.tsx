"use client"

import { useRef } from "react"
import { Upload, BookMarked, Sparkles, ScrollText, AlignLeft } from "lucide-react"

interface EmptyStateProps {
  onFileLoad: (file: File) => void
}

const FEATURES = [
  { icon: ScrollText, text: "Page-by-page chapter reading" },
  { icon: AlignLeft, text: "Serif, Sans & Mono fonts" },
  { icon: Sparkles, text: "White, Sepia & Dark themes" },
]

export function EmptyState({ onFileLoad }: EmptyStateProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFileLoad(file)
    e.target.value = ""
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file?.type === "application/pdf") onFileLoad(file)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center">
      {/* Hero illustration */}
      <div className="relative mb-8">
        <div className="size-28 rounded-3xl bg-muted flex items-center justify-center shadow-inner">
          <BookMarked className="size-12 text-primary" aria-hidden="true" />
        </div>
        <div className="absolute -top-1 -right-1 size-6 rounded-full bg-primary flex items-center justify-center shadow-md">
          <Sparkles className="size-3 text-primary-foreground" aria-hidden="true" />
        </div>
      </div>

      <h1 className="text-2xl font-bold text-balance mb-2">
        Your reading space
      </h1>
      <p className="text-sm text-muted-foreground text-balance max-w-xs mb-8 leading-relaxed">
        Upload any PDF novel or book. We&apos;ll turn each page into a smooth, scrollable chapter — optimized for one-handed mobile reading.
      </p>

      {/* Feature pills */}
      <ul className="flex flex-col gap-2 mb-10 w-full max-w-xs" aria-label="App features">
        {FEATURES.map(({ icon: Icon, text }) => (
          <li
            key={text}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-muted/60 text-sm text-muted-foreground"
          >
            <Icon className="size-4 text-primary shrink-0" aria-hidden="true" />
            {text}
          </li>
        ))}
      </ul>

      {/* Upload drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="w-full max-w-xs"
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="sr-only"
          aria-label="Upload PDF file"
          onChange={handleChange}
        />
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2.5 py-4 px-6 rounded-2xl bg-primary text-primary-foreground font-semibold text-base active:scale-95 transition-transform shadow-lg shadow-primary/20 touch-manipulation"
          aria-label="Upload a PDF to start reading"
        >
          <Upload className="size-5" aria-hidden="true" />
          Upload a PDF to start reading
        </button>
        <p className="mt-3 text-xs text-muted-foreground">
          Tap to browse or drag &amp; drop a PDF
        </p>
      </div>
    </div>
  )
}
