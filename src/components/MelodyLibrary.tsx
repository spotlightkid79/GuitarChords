import { useMemo, useRef, useState } from 'react'
import type { ImportWarnings, ParsedGpFile } from '../lib/guitarProImport'
import { playNotes } from '../lib/audio'
import { importMultipleFiles, summarizeImport } from '../lib/importFiles'
import { downloadAllLibrarySongs, downloadLibrarySong, parseLibrarySongFile } from '../lib/songLibraryFile'
import { isNoteEvent } from '../lib/rhythm'
import type { MelodyLine } from '../store/melodyStore'
import { useSongLibraryStore, type LibrarySong } from '../store/songLibraryStore'
import StaffView, { type StaffMode } from './StaffView'

const ACCEPT = '.gp,.gp3,.gp4,.gp5,.gpx'

interface PendingImport {
  parsed: ParsedGpFile
  trackIndex: number
  title: string
  artist: string
  lines: MelodyLine[]
  warnings: ImportWarnings
}

function warningMessages(w: ImportWarnings): string[] {
  const messages: string[] = []
  if (w.droppedChordNotes > 0) {
    messages.push(`${w.droppedChordNotes} note${w.droppedChordNotes === 1 ? '' : 's'} dropped from chords (kept only the top note of each).`)
  }
  if (w.approximatedTuplets > 0) {
    messages.push(`${w.approximatedTuplets} tuplet beat${w.approximatedTuplets === 1 ? '' : 's'} approximated as straight rhythm.`)
  }
  if (w.clampedDurations > 0) {
    messages.push(`${w.clampedDurations} note${w.clampedDurations === 1 ? '' : 's'} simplified to a supported duration.`)
  }
  if (w.tuningMismatch) {
    messages.push(`This track's tuning isn't standard EADGBE — frets were kept as-is, but shown/played pitch will be off.`)
  }
  return messages
}

function ImportPanel({ onDone }: { onDone: () => void }) {
  const { addSong } = useSongLibraryStore()
  const [pending, setPending] = useState<PendingImport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function loadTrack(parsed: ParsedGpFile, trackIndex: number) {
    const { mapTrackToLines } = await import('../lib/guitarProImport')
    const { lines, warnings } = mapTrackToLines(parsed.score, trackIndex)
    setPending({ parsed, trackIndex, title: parsed.title, artist: parsed.artist, lines, warnings })
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const { parseGuitarProFile } = await import('../lib/guitarProImport')
      const bytes = new Uint8Array(await file.arrayBuffer())
      const parsed = parseGuitarProFile(bytes)
      if (parsed.tracks.length === 0) {
        setError('No guitar/string tracks found in that file.')
        return
      }
      await loadTrack(parsed, parsed.tracks[0].index)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not parse that file.')
    } finally {
      setBusy(false)
    }
  }

  function handleConfirm() {
    if (!pending) return
    addSong({ title: pending.title.trim() || 'Untitled', artist: pending.artist.trim() || 'Unknown Artist', lines: pending.lines })
    setPending(null)
    onDone()
  }

  if (pending) {
    const messages = warningMessages(pending.warnings)
    return (
      <div className="mx-auto max-w-6xl rounded-lg border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={pending.title}
            onChange={(e) => setPending({ ...pending, title: e.target.value })}
            placeholder="Title"
            className="rounded-md border border-black/10 bg-black/[0.03] px-2 py-1 text-xs text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-400 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
          />
          <input
            value={pending.artist}
            onChange={(e) => setPending({ ...pending, artist: e.target.value })}
            placeholder="Artist"
            className="rounded-md border border-black/10 bg-black/[0.03] px-2 py-1 text-xs text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-400 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
          />
          {pending.parsed.tracks.length > 1 && (
            <select
              value={pending.trackIndex}
              onChange={(e) => loadTrack(pending.parsed, Number(e.target.value))}
              className="rounded-md border border-black/10 bg-black/[0.03] px-2 py-1 text-xs text-zinc-900 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
            >
              {pending.parsed.tracks.map((t) => (
                <option key={t.index} value={t.index}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-md bg-purple-500/20 px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-500/30 dark:text-purple-300"
          >
            Add to Library
          </button>
          <button
            type="button"
            onClick={() => setPending(null)}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Cancel
          </button>
        </div>
        {messages.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-amber-700/90 dark:text-amber-400/90">
            {messages.map((m, i) => (
              <li key={i}>⚠ {m}</li>
            ))}
          </ul>
        )}
        {/* Always dark — StaffView draws fixed light-colored notes assuming a dark backdrop. */}
        <div className="mt-3 rounded-md border border-white/5 bg-[#14151b] p-2">
          <StaffView items={pending.lines[0]?.items ?? []} mode="staff" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => fileInputRef.current?.click()}
        className="rounded-md bg-purple-500/20 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-500/30 disabled:opacity-50 dark:text-purple-300"
      >
        {busy ? 'Parsing…' : 'Import Guitar Pro file…'}
      </button>
      <input ref={fileInputRef} type="file" accept={ACCEPT} onChange={handleFileSelected} className="hidden" />
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}

function LibrarySongRow({ song, onEditInNotes }: { song: LibrarySong; onEditInNotes: (lines: MelodyLine[]) => void }) {
  const { renameSong, deleteSong } = useSongLibraryStore()
  const [open, setOpen] = useState(false)
  const [viewMode, setViewMode] = useState<StaffMode>('staff')
  const [playingInstanceId, setPlayingInstanceId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(song.title)
  const playbackTokenRef = useRef(0)

  function handlePlay() {
    const notesOnly = song.lines.flatMap((l) => l.items).filter(isNoteEvent)
    if (notesOnly.length === 0) return
    const token = ++playbackTokenRef.current
    const totalDuration = playNotes(
      notesOnly.map((item) => ({ stringIndex: item.stringIndex, fret: item.fret })),
      (_position, i) => {
        if (playbackTokenRef.current !== token) return
        setPlayingInstanceId(notesOnly[i].instanceId)
      },
      { sort: false },
    )
    window.setTimeout(() => {
      if (playbackTokenRef.current === token) setPlayingInstanceId(null)
    }, totalDuration * 1000)
  }

  return (
    <div className="rounded-lg border border-black/5 p-3 dark:border-white/5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col items-start gap-0.5">
          {editing ? (
            <input
              autoFocus
              value={draftTitle}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={() => {
                renameSong(song.id, { title: draftTitle.trim() || song.title, artist: song.artist })
                setEditing(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
              className="rounded border border-black/10 bg-black/5 px-1.5 py-0.5 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-purple-400 dark:border-white/10 dark:bg-white/10 dark:text-zinc-100"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraftTitle(song.title)
                setEditing(true)
              }}
              className="text-left text-sm font-semibold text-zinc-900 hover:text-purple-600 dark:text-zinc-100 dark:hover:text-purple-300"
              title="Rename"
            >
              {song.title}
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-left text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            {song.artist} {open ? '▲' : '▼'}
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <button
            type="button"
            onClick={handlePlay}
            className="hover:text-purple-600 dark:hover:text-purple-300"
            title="Play"
          >
            ▶ Play
          </button>
          <button
            type="button"
            onClick={() => onEditInNotes(song.lines)}
            className="hover:text-purple-600 dark:hover:text-purple-300"
          >
            Edit in Notes tab
          </button>
          <button
            type="button"
            onClick={() => downloadLibrarySong(song.title, song.artist, song.lines)}
            className="hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Export
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete "${song.title}"? This can't be undone.`)) deleteSong(song.id)
            }}
            className="hover:text-red-400"
          >
            Delete
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3">
          <div className="mb-2 flex w-fit items-center gap-0.5 rounded-md border border-black/10 bg-black/[0.02] p-1 dark:border-white/10 dark:bg-white/[0.03]">
            <button
              type="button"
              onClick={() => setViewMode('staff')}
              className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                viewMode === 'staff'
                  ? 'bg-purple-500 text-white'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              Staff
            </button>
            <button
              type="button"
              onClick={() => setViewMode('tab')}
              className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                viewMode === 'tab'
                  ? 'bg-purple-500 text-white'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              Tab
            </button>
          </div>
          {/* Always dark — StaffView draws fixed light-colored notes assuming a dark backdrop. */}
          <div className="flex flex-col gap-2 overflow-x-auto rounded-lg border border-white/5 bg-[#14151b] p-2">
            {song.lines.map((line) => (
              <StaffView key={line.id} items={line.items} activeInstanceId={playingInstanceId} mode={viewMode} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function MelodyLibrary({ onEditInNotes }: { onEditInNotes: (lines: MelodyLine[]) => void }) {
  const { songs, addSong } = useSongLibraryStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const grouped = useMemo(() => {
    const map = new Map<string, LibrarySong[]>()
    for (const song of songs) {
      const key = song.artist || 'Unknown Artist'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(song)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [songs])

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    // Copy out of the live FileList before resetting e.target.value — clearing the input's value
    // also empties that same FileList object, not just future reads of it.
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    importMultipleFiles(files, parseLibrarySongFile).then((result) => {
      result.imported.forEach((s) => addSong(s))
      window.alert(summarizeImport(result, 'song'))
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Song Library</h1>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          {songs.length > 0 && (
            <button
              type="button"
              onClick={() => downloadAllLibrarySongs(songs)}
              className="hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Export all
            </button>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="You can select multiple files at once"
            className="hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Import…
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" multiple onChange={handleImportFile} className="hidden" />
        </div>
      </div>

      <ImportPanel onDone={() => {}} />

      {songs.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No songs yet. Import a Guitar Pro file (.gp3/.gp4/.gp5/.gpx/.gp) to add one — only the top note of each beat is
          kept (lead/riff lines work best; full chord-strumming rhythm parts aren't supported yet).
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map(([artist, artistSongs]) => (
            <div key={artist}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{artist}</h2>
              <div className="flex flex-col gap-2">
                {artistSongs.map((song) => (
                  <LibrarySongRow key={song.id} song={song} onEditInNotes={onEditInNotes} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
