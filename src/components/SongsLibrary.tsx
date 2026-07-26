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

type ChordDisplay = 'shape' | 'name'
type PlayLayout = 'horizontal' | 'vertical'

function SongCard({
  song,
  expanded,
  onToggleExpanded,
  chordDisplay,
  playLayout,
}: {
  song: SavedSong
  expanded: boolean
  onToggleExpanded: () => void
  chordDisplay: ChordDisplay
  playLayout: PlayLayout
}) {
  const { activeSongId, deleteSong, renameSong } = useSongsStore()
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(song.name)
  const [playingInstanceId, setPlayingInstanceId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [loopSetting, setLoopSetting] = useState('1')
  const [speed, setSpeed] = useState(1)
  const [sustain, setSustain] = useState(1)
  const playbackTokenRef = useRef(0)
  const playbackHandleRef = useRef<ChordSequenceHandle | null>(null)
  const pausePositionRef = useRef(0)
  const liveRestartTimeoutRef = useRef<number | null>(null)
  useScrollPlayingIntoView(playingInstanceId)
  useEffect(
    () => () => {
      playbackHandleRef.current?.stop()
      if (liveRestartTimeoutRef.current) window.clearTimeout(liveRestartTimeoutRef.current)
    },
    [],
  )
  const isActive = activeSongId === song.id
  const chordCount = countChords(song)
  const preview = song.lines.flatMap((l) => l.items)
  const withChords = preview
    .map((item) => ({ item, chord: chordById.get(item.chordId) }))
    .filter((x): x is { item: BoardItem; chord: ChordShape } => !!x.chord)
  const currentLine = playingInstanceId
    ? song.lines.find((l) => l.items.some((i) => i.instanceId === playingInstanceId))
    : null
  const hasAnyLyrics = song.lines.some((l) => l.lyrics)

  function handleDelete() {
    if (!window.confirm(`Delete "${song.name}"? This can't be undone.`)) return
    deleteSong(song.id)
  }

  function handleStop() {
    playbackHandleRef.current?.stop()
    playbackHandleRef.current = null
    playbackTokenRef.current++
    if (liveRestartTimeoutRef.current) window.clearTimeout(liveRestartTimeoutRef.current)
    setIsPlaying(false)
    setIsPaused(false)
    setPlayingInstanceId(null)
    pausePositionRef.current = 0
  }

  /** Starts (or resumes, via `resumeFromIndex`) playback. `resumeFromIndex` counts every chord
   * across every repeat, not just within one pass — see `playChordSequence`'s `startIndex`.
   * `overrides` lets a live speed/sustain change take effect immediately, without waiting for the
   * state update (and thus a re-render) to land first. */
  function startPlayback(resumeFromIndex: number, overrides?: { speed?: number; sustain?: number }) {
    if (withChords.length === 0) return
    const token = ++playbackTokenRef.current
    const loop = loopSetting === 'infinite'
    const repeatCount = Number(loopSetting) || 1
    const effectiveSpeed = overrides?.speed ?? speed
    const effectiveSustain = overrides?.sustain ?? sustain
    const chordDuration = DEFAULT_CHORD_DURATION / effectiveSpeed
    let flatIndex = resumeFromIndex
    const handle = playChordSequence(
      withChords.map((x) => x.chord),
      (_chord, i) => {
        if (playbackTokenRef.current !== token) return
        setPlayingInstanceId(withChords[i].item.instanceId)
        pausePositionRef.current = flatIndex
        flatIndex += 1
      },
      loop
        ? { loop: true, chordDuration, sustain: effectiveSustain, startIndex: resumeFromIndex }
        : { repeatCount, chordDuration, sustain: effectiveSustain, startIndex: resumeFromIndex },
    )
    playbackHandleRef.current = handle
    setIsPlaying(true)
    setIsPaused(false)
    if (!loop) {
      const remaining = Math.max(0, handle.loopDuration * repeatCount - resumeFromIndex * chordDuration)
      window.setTimeout(
        () => {
          if (playbackTokenRef.current !== token) return
          setIsPlaying(false)
          setIsPaused(false)
          setPlayingInstanceId(null)
          playbackHandleRef.current = null
          pausePositionRef.current = 0
        },
        remaining * 1000,
      )
    }
  }

  function handlePlay() {
    if (isPlaying) {
      handleStop()
      return
    }
    startPlayback(0)
  }

  /** Debounces a live speed/sustain tweak into a reschedule from the current chord, so dragging
   * the slider doesn't retrigger the chord on every pixel of movement. No-ops while stopped or
   * paused — paused playback just picks up the new value whenever it's resumed. */
  function scheduleLiveRestart(overrides: { speed?: number; sustain?: number }) {
    if (!isPlaying || isPaused) return
    if (liveRestartTimeoutRef.current) window.clearTimeout(liveRestartTimeoutRef.current)
    liveRestartTimeoutRef.current = window.setTimeout(() => {
      liveRestartTimeoutRef.current = null
      playbackHandleRef.current?.stop()
      playbackHandleRef.current = null
      startPlayback(pausePositionRef.current, overrides)
    }, 150)
  }

  function handleSpeedChange(value: number) {
    setSpeed(value)
    scheduleLiveRestart({ speed: value })
  }

  function handleSustainChange(value: number) {
    setSustain(value)
    scheduleLiveRestart({ sustain: value })
  }

  /** Silences playback but remembers where it was, so Space can pick back up from there. */
  function handlePause() {
    playbackHandleRef.current?.stop()
    playbackHandleRef.current = null
    playbackTokenRef.current++
    if (liveRestartTimeoutRef.current) window.clearTimeout(liveRestartTimeoutRef.current)
    setIsPaused(true)
  }

  /** Jumps the current (or paused) chord forward/back by `delta`. While paused this just moves
   * the frozen position silently; while playing it restarts the sequence from the new chord. */
  function skipBy(delta: number) {
    if (withChords.length === 0) return
    const newIndex = Math.max(0, pausePositionRef.current + delta)
    if (isPaused) {
      pausePositionRef.current = newIndex
      setPlayingInstanceId(withChords[newIndex % withChords.length].item.instanceId)
      return
    }
    playbackHandleRef.current?.stop()
    playbackHandleRef.current = null
    startPlayback(newIndex)
  }

  useEffect(() => {
    if (!isPlaying) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space' && e.code !== 'ArrowRight' && e.code !== 'ArrowLeft') return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      e.preventDefault()
      if (e.code === 'ArrowRight') {
        skipBy(1)
      } else if (e.code === 'ArrowLeft') {
        skipBy(-1)
      } else if (isPaused) {
        startPlayback(pausePositionRef.current)
      } else {
        handlePause()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // Re-subscribes whenever anything the handler closes over changes, so it never fires with a
    // stale speed/sustain/loopSetting (e.g. after adjusting a slider mid-playback).
  }, [isPlaying, isPaused, speed, sustain, loopSetting])

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
          title={
            isPlaying
              ? isPaused
                ? 'Stop (Space to resume, ←/→ to skip)'
                : 'Stop (Space to pause, ←/→ to skip)'
              : 'Play song'
          }
          className={`flex h-5 items-center justify-center rounded-sm border px-1.5 text-[10px] leading-none transition-colors disabled:opacity-30 ${
            isPlaying
              ? 'border-amber-400 text-amber-300 hover:border-amber-300'
              : 'border-zinc-500 text-zinc-400 hover:border-zinc-300 hover:text-zinc-200'
          }`}
        >
          {isPlaying ? (isPaused ? '❙❙ Paused' : '■ Stop') : '▶ Play'}
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
        <div className="flex items-center gap-1" title="Playback speed — adjustable while playing">
          <input
            type="range"
            min="0.1"
            max="8"
            step="0.05"
            value={speed}
            onChange={(e) => handleSpeedChange(Number(e.target.value))}
            className="h-1 w-20 accent-purple-400"
          />
          <span className="w-9 text-[10px] text-zinc-500">{speed.toFixed(2)}x</span>
        </div>
        <div
          className="flex items-center gap-1"
          title="Sustain — how long each chord rings, independent of tempo. Adjustable while playing"
        >
          <input
            type="range"
            min="0.1"
            max="8"
            step="0.05"
            value={sustain}
            onChange={(e) => handleSustainChange(Number(e.target.value))}
            className="h-1 w-20 accent-amber-400"
          />
          <span className="w-9 text-[10px] text-zinc-500">{sustain.toFixed(2)}x</span>
        </div>
      </div>

      <div className="text-xs text-zinc-500">
        {song.lines.length} line{song.lines.length === 1 ? '' : 's'} · {chordCount} chord{chordCount === 1 ? '' : 's'}
      </div>
      <div className="text-[11px] text-zinc-600">Updated {formatDate(song.updatedAt)}</div>

      {isPlaying ? (
        <div
          className={`mt-1 flex flex-col gap-3 rounded-lg border p-3 ${
            isPaused ? 'border-zinc-500/40 bg-white/[0.03]' : 'border-amber-400/30 bg-amber-400/5'
          }`}
        >
          {isPaused && (
            <p className="text-center text-[11px] font-medium text-zinc-400">
              ❙❙ Paused — press Space to resume, ←/→ to skip chords
            </p>
          )}
          {/* Collapsed cards are too narrow to read shape diagrams while scrolling through a whole
              song, so playback always falls back to names there regardless of the Shape/Name toggle. */}
          {(expanded ? chordDisplay : 'name') === 'shape' ? (
            <div
              className={
                playLayout === 'horizontal'
                  ? 'flex gap-2 overflow-x-auto pb-1'
                  : 'flex max-h-72 flex-col gap-2 overflow-y-auto pr-1'
              }
            >
              {preview.map((item) => {
                const chord = chordById.get(item.chordId)
                return chord ? (
                  <div key={item.instanceId} data-instance-id={item.instanceId} className="shrink-0">
                    <CardBody chord={chord} playing={item.instanceId === playingInstanceId} />
                  </div>
                ) : null
              })}
            </div>
          ) : (
            <div
              className={
                playLayout === 'horizontal'
                  ? 'flex gap-1.5 overflow-x-auto pb-1'
                  : 'flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1'
              }
            >
              {preview.map((item) => {
                const chord = chordById.get(item.chordId)
                const playing = item.instanceId === playingInstanceId
                return chord ? (
                  <span
                    key={item.instanceId}
                    data-instance-id={item.instanceId}
                    className={`shrink-0 rounded px-2 py-1 text-center text-sm font-semibold transition-colors ${
                      playing ? 'bg-amber-400 text-zinc-900' : 'bg-white/10 text-zinc-400'
                    }`}
                  >
                    {chord.label}
                  </span>
                ) : null
              })}
            </div>
          )}
          {hasAnyLyrics && (
            <p className="min-h-[1.75rem] text-center text-base font-medium text-amber-200">
              {currentLine?.lyrics || ' '}
            </p>
          )}
        </div>
      ) : (
        <>
          {!expanded && preview.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {preview.slice(0, 8).map((item) => {
                const chord = chordById.get(item.chordId)
                return chord ? (
                  <span
                    key={item.instanceId}
                    data-instance-id={item.instanceId}
                    className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-zinc-300 transition-colors"
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
                  ) : chordDisplay === 'shape' ? (
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
                            <CardBody chord={chord} />
                          </button>
                        ) : null
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {line.items.map((item) => {
                        const chord = chordById.get(item.chordId)
                        return chord ? (
                          <div key={item.instanceId} className="group/chord relative">
                            <button
                              type="button"
                              data-instance-id={item.instanceId}
                              onClick={() => playChord(chord)}
                              className="rounded bg-white/10 px-2 py-1 text-sm font-semibold text-zinc-200 transition-colors hover:bg-white/20"
                            >
                              {chord.label}
                            </button>
                            <div className="pointer-events-none absolute bottom-full left-full z-20 mb-1 ml-1 rounded-lg bg-[#14151b] opacity-0 shadow-xl ring-1 ring-white/10 transition-opacity delay-150 group-hover/chord:opacity-100">
                              <CardBody chord={chord} />
                            </div>
                          </div>
                        ) : null
                      })}
                    </div>
                  )}
                  {line.lyrics && <p className="text-xs italic text-zinc-500">{line.lyrics}</p>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function SongsLibrary() {
  const songs = useSongsStore((s) => s.songs)
  const saveAsNew = useSongsStore((s) => s.saveAsNew)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [chordDisplay, setChordDisplay] = useState<ChordDisplay>('shape')
  const [playLayout, setPlayLayout] = useState<PlayLayout>('horizontal')
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
          <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-1">
            {(
              [
                ['shape', 'Shape'],
                ['name', 'Name'],
              ] as [ChordDisplay, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setChordDisplay(value)}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  chordDisplay === value ? 'bg-purple-500 text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-1">
            {(
              [
                ['horizontal', '↔ Horizontal'],
                ['vertical', '↕ Vertical'],
              ] as [PlayLayout, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPlayLayout(value)}
                title="Direction chords play in while a song is playing"
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  playLayout === value ? 'bg-purple-500 text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
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
            chordDisplay={chordDisplay}
            playLayout={playLayout}
          />
        ))}
      </div>
    </div>
  )
}
