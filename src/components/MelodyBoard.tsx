import { useDroppable } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import { playNotes } from '../lib/audio'
import { useMelodyStore, type MelodyLine, type MelodyNoteItem } from '../store/melodyStore'
import ExpandToggle from './ExpandToggle'

export function melodyLineDroppableId(lineId: string) {
  return `melody-line:${lineId}`
}

function MelodyNoteTile({ item, onRemove }: { item: MelodyNoteItem; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.instanceId,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative touch-none ${isDragging ? 'opacity-40' : ''}`}
    >
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${item.note}`}
        className="absolute -right-1.5 -top-1.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-700 text-[10px] leading-none text-zinc-200 hover:bg-red-500/80"
      >
        ×
      </button>
      <button
        type="button"
        onClick={() => playNotes([{ stringIndex: item.stringIndex, fret: item.fret }])}
        className="flex h-12 w-12 cursor-grab items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-zinc-100 hover:border-purple-400/50 active:cursor-grabbing"
        {...listeners}
        {...attributes}
      >
        {item.note}
      </button>
    </div>
  )
}

function MelodyLineRow({ line, index, total }: { line: MelodyLine; index: number; total: number }) {
  const { removeItem, removeLine, renameLine, moveLine } = useMelodyStore()
  const { setNodeRef, isOver } = useDroppable({ id: melodyLineDroppableId(line.id) })
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(line.name)

  function handlePlay() {
    playNotes(line.items.map((i) => ({ stringIndex: i.stringIndex, fret: i.fret })))
  }

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
            disabled={line.items.length === 0}
            onClick={handlePlay}
            className="hover:text-purple-300 disabled:opacity-30"
            aria-label="Play line"
            title="Play line"
          >
            ▶
          </button>
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
        data-melody-line-id={line.id}
        className={`flex min-h-[5.5rem] flex-1 flex-wrap items-start gap-3 rounded-lg border border-white/5 p-3 transition-colors ${
          isOver ? 'bg-purple-500/10' : ''
        }`}
      >
        {line.items.length === 0 ? (
          <p className="m-auto text-xs text-zinc-600">Drag notes here from the fretboard</p>
        ) : (
          <SortableContext items={line.items.map((i) => i.instanceId)} strategy={horizontalListSortingStrategy}>
            {line.items.map((item) => (
              <MelodyNoteTile key={item.instanceId} item={item} onRemove={() => removeItem(line.id, item.instanceId)} />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  )
}

export default function MelodyBoard() {
  const { lines, addLine, clearAll } = useMelodyStore()
  const [collapsed, setCollapsed] = useState(false)

  const allNotes = lines.flatMap((l) => l.items).map((i) => ({ stringIndex: i.stringIndex, fret: i.fret }))

  return (
    <div className="border-t border-white/10 bg-[#14151b]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 pt-2">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Melody</h2>
          <ExpandToggle expanded={!collapsed} onClick={() => setCollapsed((c) => !c)} />
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            disabled={allNotes.length === 0}
            onClick={() => playNotes(allNotes)}
            className="text-xs font-medium text-purple-300 hover:text-purple-200 disabled:opacity-30"
          >
            ▶ Play melody
          </button>
          <button type="button" onClick={addLine} className="text-xs font-medium text-purple-300 hover:text-purple-200">
            + Add line
          </button>
          <button type="button" onClick={clearAll} className="text-xs text-zinc-500 hover:text-red-400">
            Clear all
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="mx-auto flex max-h-96 max-w-6xl flex-col gap-3 overflow-y-auto p-4">
          {lines.map((line, i) => (
            <MelodyLineRow key={line.id} line={line} index={i} total={lines.length} />
          ))}
        </div>
      )}
    </div>
  )
}
