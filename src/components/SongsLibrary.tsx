import { useState } from 'react'
import { CHORDS } from '../data/chords'
import { downloadSong } from '../lib/songFile'
import { useProgressionStore } from '../store/progressionStore'
import { useSongsStore, type SavedSong } from '../store/songsStore'
import { CardBody } from './ChordCard'

const chordById = new Map(CHORDS.map((c) => [c.id, c]))

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
  const setLines = useProgressionStore((s) => s.setLines)
  const { activeSongId, setActive, deleteSong, renameSong } = useSongsStore()
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(song.name)
  const isActive = activeSongId === song.id
  const chordCount = countChords(song)
  const preview = song.lines.flatMap((l) => l.items)

  function handleOpen() {
    setLines(song.lines)
    setActive(song.id)
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${song.name}"? This can't be undone.`)) return
    deleteSong(song.id)
  }

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border p-3 ${expanded ? 'col-span-full' : ''} ${
        isActive ? 'border-purple-400/50 bg-purple-500/5' : 'border-white/10 bg-white/5'
      }`}
    >
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

      <div className="text-xs text-zinc-500">
        {song.lines.length} line{song.lines.length === 1 ? '' : 's'} · {chordCount} chord{chordCount === 1 ? '' : 's'}
      </div>
      <div className="text-[11px] text-zinc-600">Updated {formatDate(song.updatedAt)}</div>

      {!expanded && preview.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {preview.slice(0, 8).map((item) => {
            const chord = chordById.get(item.chordId)
            return chord ? (
              <span key={item.instanceId} className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-zinc-300">
                {chord.label}
              </span>
            ) : null
          })}
          {preview.length > 8 && <span className="text-[10px] text-zinc-600">+{preview.length - 8} more</span>}
        </div>
      )}

      <div className="flex items-center gap-3 text-xs">
        <button type="button" onClick={handleOpen} className="font-medium text-purple-300 hover:text-purple-200">
          {isActive ? 'Open in board ✓' : 'Open in board'}
        </button>
        <button type="button" onClick={onToggleExpanded} className="text-zinc-500 hover:text-zinc-300">
          {expanded ? 'Collapse' : 'Expand'}
        </button>
        <button
          type="button"
          onClick={() => downloadSong(song.name, song.lines)}
          className="text-zinc-500 hover:text-zinc-300"
        >
          Export
        </button>
        <button type="button" onClick={handleDelete} className="text-zinc-500 hover:text-red-400">
          Delete
        </button>
      </div>

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
                    return chord ? <CardBody key={item.instanceId} chord={chord} /> : null
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SongsLibrary() {
  const songs = useSongsStore((s) => s.songs)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  if (songs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center py-16 text-center text-sm text-zinc-500">
        No songs saved yet. Head to the Chords tab, build a progression in the Song board, then hit "Save as new song".
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
        <h2 className="text-lg font-semibold text-zinc-100">Your songs</h2>
        <div className="flex items-center gap-3">
          <button type="button" onClick={toggleAll} className="text-xs font-medium text-purple-300 hover:text-purple-200">
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </button>
          <span className="text-xs text-zinc-500">{songs.length} saved</span>
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
