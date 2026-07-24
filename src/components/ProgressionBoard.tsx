import { useDroppable } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { useState } from 'react'
import { CHORDS } from '../data/chords'
import { useProgressionStore, type BoardLine } from '../store/progressionStore'
import { useSongsStore } from '../store/songsStore'
import { BoardChordCard } from './ChordCard'

const chordById = new Map(CHORDS.map((c) => [c.id, c]))

export function lineDroppableId(lineId: string) {
  return `line:${lineId}`
}

function ProgressionLineRow({ line, index, total }: { line: BoardLine; index: number; total: number }) {
  const { removeItem, removeLine, renameLine, moveLine } = useProgressionStore()
  const { setNodeRef, isOver } = useDroppable({ id: lineDroppableId(line.id) })
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(line.name)

  return (
    <div className="flex items-start gap-3">
      <div className="flex w-24 shrink-0 flex-col items-start gap-1.5 pt-2">
        {editing ? (
          <input
            autoFocus
            value={draftName}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={() => {
              renameLine(line.id, draftName.trim() || line.name)
              setEditing(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
            className="w-full rounded border border-white/10 bg-white/10 px-1.5 py-0.5 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-purple-400"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraftName(line.name)
              setEditing(true)
            }}
            className="truncate text-left text-xs font-semibold text-zinc-300 hover:text-purple-300"
            title="Rename line"
          >
            {line.name}
          </button>
        )}
        <div className="flex gap-1.5 text-[10px] text-zinc-500">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => moveLine(line.id, -1)}
            className="hover:text-zinc-300 disabled:opacity-30"
            aria-label="Move line up"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => moveLine(line.id, 1)}
            className="hover:text-zinc-300 disabled:opacity-30"
            aria-label="Move line down"
          >
            ↓
          </button>
          <button type="button" onClick={() => removeLine(line.id)} className="hover:text-red-400">
            remove
          </button>
        </div>
      </div>

      <div
        ref={setNodeRef}
        data-line-id={line.id}
        className={`flex min-h-[9.5rem] flex-1 flex-wrap items-start gap-3 rounded-lg border border-white/5 p-3 transition-colors ${
          isOver ? 'bg-purple-500/10' : ''
        }`}
      >
        {line.items.length === 0 ? (
          <p className="m-auto text-xs text-zinc-600">Drop chords here</p>
        ) : (
          <SortableContext items={line.items.map((i) => i.instanceId)} strategy={horizontalListSortingStrategy}>
            {line.items.map((item) => {
              const chord = chordById.get(item.chordId)
              if (!chord) return null
              return (
                <BoardChordCard
                  key={item.instanceId}
                  instanceId={item.instanceId}
                  chord={chord}
                  onRemove={() => removeItem(line.id, item.instanceId)}
                />
              )
            })}
          </SortableContext>
        )}
      </div>
    </div>
  )
}

function SongControls() {
  const { lines, setLines, clearAll } = useProgressionStore()
  const { songs, activeSongId, saveAsNew, updateExisting, renameSong, deleteSong, setActive } =
    useSongsStore()
  const activeSong = songs.find((s) => s.id === activeSongId) ?? null
  const [name, setName] = useState(activeSong?.name ?? 'Untitled Song')

  function handleSave() {
    const trimmed = name.trim() || 'Untitled Song'
    if (activeSong) {
      updateExisting(activeSong.id, lines)
      if (trimmed !== activeSong.name) renameSong(activeSong.id, trimmed)
    } else {
      saveAsNew(trimmed, lines)
    }
  }

  function handleNew() {
    clearAll()
    setActive(null)
    setName('Untitled Song')
  }

  function handleLoad(id: string) {
    const song = songs.find((s) => s.id === id)
    if (!song) return
    setLines(song.lines)
    setActive(song.id)
    setName(song.name)
  }

  function handleDelete() {
    if (!activeSong) return
    if (!window.confirm(`Delete "${activeSong.name}"? This can't be undone.`)) return
    deleteSong(activeSong.id)
    clearAll()
    setName('Untitled Song')
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 pb-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        placeholder="Song name"
        className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-400"
      />
      <button
        type="button"
        onClick={handleSave}
        className="rounded-md bg-purple-500/20 px-2 py-1 text-xs font-medium text-purple-300 hover:bg-purple-500/30"
      >
        {activeSong ? 'Save' : 'Save as new song'}
      </button>
      <button type="button" onClick={handleNew} className="text-xs text-zinc-500 hover:text-zinc-300">
        New song
      </button>

      {songs.length > 0 && (
        <>
          <select
            value={activeSongId ?? ''}
            onChange={(e) => handleLoad(e.target.value)}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-100"
          >
            <option value="" disabled>
              Load a saved song…
            </option>
            {songs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {activeSong && (
            <button type="button" onClick={handleDelete} className="text-xs text-zinc-500 hover:text-red-400">
              Delete
            </button>
          )}
        </>
      )}
    </div>
  )
}

export default function ProgressionBoard() {
  const { lines, addLine, clearAll } = useProgressionStore()
  const activeSongId = useSongsStore((s) => s.activeSongId)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="border-t border-white/10 bg-[#14151b]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 pt-2">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Song</h2>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            {collapsed ? 'Expand' : 'Collapse'}
          </button>
        </div>
        <div className="flex items-center gap-4">
          <button type="button" onClick={addLine} className="text-xs font-medium text-purple-300 hover:text-purple-200">
            + Add line
          </button>
          <button type="button" onClick={clearAll} className="text-xs text-zinc-500 hover:text-red-400">
            Clear all
          </button>
        </div>
      </div>

      <SongControls key={activeSongId ?? 'new'} />

      {!collapsed && (
        <div className="mx-auto flex max-h-96 max-w-6xl flex-col gap-3 overflow-y-auto p-4">
          {lines.map((line, i) => (
            <ProgressionLineRow key={line.id} line={line} index={i} total={lines.length} />
          ))}
        </div>
      )}
    </div>
  )
}
