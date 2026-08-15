import type { ChangeEvent, DragEvent, ReactNode } from 'react'
import { useCallback, useState } from 'react'

type CsvUploaderProps = {
  onFile: (text: string) => void
  onError?: (message: string) => void
  loading?: boolean
  label?: string
  className?: string
  children?: ReactNode
}

async function readTextFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buffer)
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(buffer)
  }

  return new TextDecoder('utf-8').decode(buffer)
}

export default function CsvUploader({
  onFile,
  onError,
  loading,
  label = 'Import',
  className = 'comic-upload',
  children,
}: CsvUploaderProps) {
  const [dragging, setDragging] = useState(false)

  const ingest = useCallback(
    async (file: File | undefined) => {
      if (!file || loading) return
      const name = file.name.toLowerCase()
      if (name.endsWith('.xls') || name.endsWith('.xlsx')) {
        onError?.('Export a CSV from prestocard.ca. Excel files cannot be imported.')
        return
      }
      onFile(await readTextFile(file))
    },
    [loading, onError, onFile],
  )

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    void ingest(file)
    e.target.value = ''
  }

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setDragging(false)
    void ingest(e.dataTransfer.files?.[0])
  }

  return (
    <label
      className={`${className} ${loading ? 'is-loading' : ''} ${dragging ? 'is-dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {children ?? (loading ? 'Working…' : label)}
      <input
        type="file"
        accept=".csv,.txt,.tsv,text/csv,text/plain,text/tab-separated-values"
        onChange={handleChange}
        disabled={loading}
      />
    </label>
  )
}
