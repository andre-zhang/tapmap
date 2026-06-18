import type { ChangeEvent } from 'react'

type CsvUploaderProps = {
  onFile: (text: string) => void
  loading?: boolean
}

export default function CsvUploader({ onFile, loading }: CsvUploaderProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') onFile(reader.result)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <label className={`comic-upload ${loading ? 'is-loading' : ''}`}>
      {loading ? '…' : 'IMPORT'}
      <input type="file" accept=".csv,text/csv" onChange={handleChange} disabled={loading} />
    </label>
  )
}
