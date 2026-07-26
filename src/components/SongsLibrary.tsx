import { useEffect, useRef, useState } from 'react'
import { CHORDS, type ChordShape } from '../data/chords'
import { DEFAULT_CHORD_DURATION, playChord, playChordSequence, type ChordSequenceHandle } from '../lib/audio'
import { importMultipleFiles, summarizeImport } from '../lib/importFiles'
import { downloadAllSongs, downloadSong, parseSongFile } from '../lib/songFile'
import { useScrollPlayingIntoView } from '../lib/useScrollPlayingIntoView'
import { useSongsStore, type SavedSong } from '../store/songsStore'
import type { BoardItem } from '../store/progressionStore'
import { CardBody } from './ChordCard'
import ExpandToggle from './ExpandToggle'

const chordById = new Map(CHORDS.map((c) => [c.id, c]))

const LOOP_OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: 'Off' },
  { value: '2', label: '2×' },
  { value: '4', label: '4×' },
  { value: '8', label: '8×' },
  { value: 'infinite', label: '∞' },
]

function countChords(song: SavedSong) {
  return song.lines.reduce((sum, l) => sum + l.items.length, 0)
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function SongCard({
  song,
  expanded,
  onToggleExpanded,
}: {
  song: SavedSong
  expanded: boolean
  onToggleExpanded: () => void
}) {
  const { activeSongId, deleteSong, renameSong } = useSongsStore()
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(song.name)
  const [playingInstanceId, setPlayingInstanceId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [loopSetting, setLoopSetting] = useState('1')
  const [speed, setSpeed] = useState(1)
  const [sustain, setSustain] = useState(1)
  const playbackTokenRef = useRef(0)
  const playbackHandleRef = useRef<ChordSequenceHandle | null>(null)
  useScrollPlayingIntoView(playingInstanceId)
  useEffect(() => () => playbackHandleRef.current?.stop(), [])
  const isActive = activeSongId === song.id
  const chordCount = countChords(song)
  const preview = song.lines.flatMap((l) => l.items)

  function handleDelete() {
    if (!window.confirm(`Delete "${song.name}"? This can't be undone.`)) return
    deleteSong(song.id)
  }

  function handleStop() {
    playbackHandleRef.current?.stop()
    playbackHandleRef.current = null
    playbackTokenRef.current++
    setIsPlaying(false)
    setPlayingInstanceId(null)
  }

  function handlePlay() {
    if (isPlaying) {
      handleStop()
      return
    }
    const withChords = preview
      .map((item) => ({ item, chord: chordById.get(item.chordId) }))
      .filter((x): x is { item: BoardItem; chord: ChordShape } => !!x.chord)
    if (withChords.length === 0) return
    const token = ++playbackTokenRef.current
    const loop = loopSetting === 'infinite'
    const repeatCount = Number(loopSetting) || 1
    const chordDuration = DEFAULT_CHORD_DURATION / speed
    const handle = playChordSequence(
      withChords.map((x) => x.chord),
      (_chord, i) => {
        if (playbackTokenRef.current !== token) return
        setPlayingInstanceId(withChords[i].item.instanceId)
      },
      loop ? { loop: true, chordDuration, sustain } : { repeatCount, chordDuration, sustain },
    )
    playbackHandleRef.current = handle
    setIsPlaying(true)
    if (!loop) {
      window.setTimeout(
        () => {
          if (playbackTokenRef.current !== token) return
          setIsPlaying(false)
          setPlayingInstanceId(null)
          playbackHandleRef.current = null
        },
        handle.loopDuration * repeatCount * 1000,
      )
    }
  }

  return (
    <div
      className={`relative flex flex-col gap-2 rounded-lg border p-3 pl-24 ${expanded ? 'col-span-full' : ''} ${
        isActive ? 'border-purple-400/50 bg-purple-500/5' : 'border-white/10 bg-white/5'
      }`}
    >
      <div className="absolute left-2 top-2 flex items-center gap-1">
        <button
          type="button"
          onClick={() => downloadSong(song.name, song.lines)}
          aria-label="Export"
          title="Export"
          className="flex h-4 w-4 items-center justify-center rounded-sm border border-zinc-500 text-[10px] leading-none text-zinc-400 hover:border-zinc-300 hover:text-zinc-200"
        >
          ↓
        </button>
        <ExpandToggle expanded={expanded} onClick={onToggleExpanded} />
        <button
          type="button"
          onClick={handleDelete}
          aria-label="Delete"
          title="Delete"
          className="flex h-4 w-4 items-center justify-center rounded-sm border border-zinc-500 text-[10px] leading-none text-zinc-400 hover:border-red-400 hover:text-red-400"
        >
          ×
        </button>
      </div>

      {editing ? (
        <input
          autoFocus
          value={draftName}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={() => {
            renameSong(song.id, draftName.trim() || song.name)
            setEditing(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          className="rounded border border-white/10 bg-white/10 px-1.5 py-1 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-purple-400"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraftName(song.name)
            setEditing(true)
          }}
          className="truncate text-left text-sm font-semibold text-zinc-100 hover:text-purple-300"
          title="Rename song"
        >
          {song.name}
        </button>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={chordCount === 0}
          onClick={handlePlay}
          aria-label={isPlaying ? 'Stop' : 'Play song'}
          title={isPlaying ? 'Stop' : 'Play song'}
          className={`flex h-5 items-center justify-center rounded-sm border px-1.5 text-[10px] leading-none transition-colors disabled:opacity-30 ${
            isPlaying
              ? 'border-amber-400 text-amber-300 hover:border-amber-300'
              : 'border-zinc-500 text-zinc-400 hover:border-zinc-300 hover:text-zinc-200'
          }`}
        >
          {isPlaying ? '■ Stop' : '▶ Play'}
        </button>
        <select
          value={loopSetting}
          onChange={(e) => setLoopSetting(e.target.value)}
          disabled={isPlaying}
          title="Repeat"
          className="h-5 rounded-sm border border-zinc-500 bg-transparent px-1 text-[10px] leading-none text-zinc-400 disabled:opacity-50"
        >
          {LOOP_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="bg-[#1a1b22] text-zinc-200">
              {o.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1" title="Playback speed">
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.25"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            disabled={isPlaying}
            className="h-1 w-14 accent-purple-400 disabled:opacity-50"
          />
          <span className="w-8 text-[10px] text-zinc-500">{speed.toFixed(2)}x</span>
        </div>
        <div className="flex items-center gap-1" title="Sustain — how long each chord rings, independent of tempo">
          <input
            type="range"
            min="0.25"
            max="3"
            step="0.25"
            value={sustain}
            onChange={(e) => setSustain(Number(e.target.value))}
            disabled={isPlaying}
            className="h-1 w-14 accent-amber-400 disabled:opacity-50"
          />
          <span className="w-8 text-[10px] text-zinc-500">{sustain.toFixed(2)}x</span>
        </div>
      </div>

      <div className="text-xs text-zinc-500">
        {song.lines.length} line{song.lines.length === 1 ? '' : 's'} · {chordCount} chord{chordCount === 1 ? '' : 's'}
      </div>
      <div className="text-[11px] text-zinc-600">Updated {formatDate(song.updatedAt)}</div>

      {!expanded && preview.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {preview.slice(0, 8).map((item) => {
            const chord = chordById.get(item.chordId)
            const playing = item.instanceId === playingInstanceId
            return chord ? (
              <span
                key={item.instanceId}
                data-instance-id={item.instanceId}
                className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                  playing ? 'bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/60' : 'bg-white/10 text-zinc-300'
                }`}
              >
                {chord.label}
              </span>
            ) : null
          })}
          {preview.length > 8 && <span className="text-[10px] text-zinc-600">+{preview.length - 8} more</span>}
        </div>
      )}

      {expanded && (
        <div className="mt-1 flex flex-col gap-4 border-t border-white/10 pt-3">
          {song.lines.map((line) => (
            <div key={line.id} className="flex flex-col gap-2">
              <div className="text-xs font-semibold text-zinc-400">{line.name}</div>
              {line.items.length === 0 ? (
                <p className="text-xs text-zinc-600">No chords in this line</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {line.items.map((item) => {
                    const chord = chordById.get(item.chordId)
                    return chord ? (
                      <button
                        key={item.instanceId}
                        type="button"
                        data-instance-id={item.instanceId}
                        onClick={() => playChord(chord)}
                        className="text-left"
                      >
                        <CardBody chord={chord} playing={item.instanceId === playingInstanceId} />
                      </button>
                    ) : null
                  })}
                </div>
              )}
              {line.lyrics && <p className="text-xs italic text-zinc-500">{line.lyrics}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SongsLibrary() {
  const songs = useSongsStore((s) => s.songs)
  const saveAsNew = useSongsStore((s) => s.saveAsNew)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    // Copy out of the live FileList before resetting e.target.value — clearing the input's value
    // also empties that same FileList object, not just future reads of it.
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    importMultipleFiles(files, parseSongFile).then((result) => {
      result.imported.forEach((s) => saveAsNew(s.name, s.lines))
      window.alert(summarizeImport(result, 'song'))
    })
  }

  const importControls = (
    <>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        title="You can select multiple files at once"
        className="text-xs text-zinc-500 hover:text-zinc-300"
      >
        Import…
      </button>
      <input ref={fileInputRef} type="file" accept="application/json" multiple onChange={handleImportFile} className="hidden" />
    </>
  )

  if (songs.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center text-sm text-zinc-500">
        <p>
          No songs saved yet. Head to the Chords tab, build a progression in the Song board, then hit "Save as new
          song" — or import songs you've already exported.
        </p>
        <div className="flex items-center gap-3">{importControls}</div>
      </div>
    )
  }

  const sorted = [...songs].sort((a, b) => b.updatedAt - a.updatedAt)
  const allExpanded = sorted.every((s) => expandedIds.has(s.id))

  function toggleOne(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setExpandedIds(allExpanded ? new Set() : new Set(sorted.map((s) => s.id)))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ExpandToggle expanded={allExpanded} onClick={toggleAll} />
          <span className="text-xs text-zinc-500">All · {songs.length} saved</span>
          <h2 className="text-lg font-semibold text-zinc-100">Your songs</h2>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <button type="button" onClick={() => downloadAllSongs(songs)} className="hover:text-zinc-300">
            Export all
          </button>
          {importControls}
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        {sorted.map((song) => (
          <SongCard
            key={song.id}
            song={song}
            expanded={expandedIds.has(song.id)}
            onToggleExpanded={() => toggleOne(song.id)}
          />
        ))}
      </div>
    </div>
  )
}
