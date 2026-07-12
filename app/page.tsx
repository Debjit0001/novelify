import { ReaderProvider } from "@/components/reader/ReaderContext"
import { ReaderApp } from "@/components/reader/ReaderApp"

export default function Page() {
  return (
    <ReaderProvider>
      <ReaderApp />
    </ReaderProvider>
  )
}
