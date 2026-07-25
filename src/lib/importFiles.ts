export interface FileImportResult<T> {
  imported: T[]
  failed: { file: string; error: string }[]
}

/** Reads and parses every selected file, tolerating individual failures so one bad/unrelated file
 * doesn't block importing the rest — lets a user restore their whole library in one selection
 * instead of one file at a time. */
export async function importMultipleFiles<T>(
  files: FileList | File[],
  parse: (raw: string) => T[],
): Promise<FileImportResult<T>> {
  const results = await Promise.all(
    Array.from(files).map(async (file) => {
      try {
        const raw = await file.text()
        return { ok: true as const, items: parse(raw) }
      } catch (err) {
        return { ok: false as const, file: file.name, error: err instanceof Error ? err.message : 'Invalid file' }
      }
    }),
  )
  return {
    imported: results.filter((r): r is { ok: true; items: T[] } => r.ok).flatMap((r) => r.items),
    failed: results.filter((r): r is { ok: false; file: string; error: string } => !r.ok).map(({ file, error }) => ({ file, error })),
  }
}

export function summarizeImport(result: FileImportResult<unknown>, noun: string): string {
  const parts: string[] = []
  if (result.imported.length > 0) {
    parts.push(`Imported ${result.imported.length} ${noun}${result.imported.length === 1 ? '' : 's'}.`)
  }
  if (result.failed.length > 0) {
    parts.push(
      `${result.failed.length} file${result.failed.length === 1 ? '' : 's'} couldn't be imported: ${result.failed
        .map((f) => f.file)
        .join(', ')}`,
    )
  }
  return parts.length > 0 ? parts.join(' ') : 'No valid data found in the selected file(s).'
}
