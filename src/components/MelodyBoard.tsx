import { useDroppable } from '@dnd-kit/core'
import { useRef, useState } from 'react'
import { playNotes } from '../lib/audio'
import { useMelodyStore, type MelodyLine, type MelodyNoteItem } from '../store/melodyStore'
import ExpandToggle from './ExpandToggle'
import StaffView from './StaffView'

export function melodyLineDroppableId(lineId: string) {
  return `melody-line:${lineId}`
}

interface PlayingItem {
  lineId: string
  instanceId: string
}

function MelodyLineRow({
  line,
  index,
  total,
  activeInstanceId,
  onPlay,
}: {
  line: MelodyLine
  index: number
  total: number
  activeInstanceId: string | null
  onPlay: () => void
}) {
  const { removeItem, removeLine, renameLine, moveLine } = useMelodyStore()
  const { setNodeRef, isOver } = useDroppable({ id: melodyLineDroppableId(line.id) })
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
            disabled={line.items.length === 0}
            onClick={onPlay}
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
        className={`relative flex min-h-[5.5rem] flex-1 items-center overflow-x-auto rounded-lg border border-white/5 p-2 transition-colors ${
          isOver ? 'bg-purple-500/10' : ''
        }`}
      >
        {line.items.length === 0 && (
          <p className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-xs text-zinc-600">
            Drag notes here from the fretboard
          </p>
        )}
        <StaffView items={line.items} onRemove={(instanceId) => removeItem(line.id, instanceId)} activeInstanceId={activeInstanceId} />
      </div>
    </div>
  )
}

export default function MelodyBoard() {
  const { lines, addLine, clearAll } = useMelodyStore()
  const [collapsed, setCollapsed] = useState(false)
  const [playingItem, setPlayingItem] = useState<PlayingItem | null>(null)
  const playbackTokenRef = useRef(0)

  function playSequence(sequence: { lineId: string; item: MelodyNoteItem }[]) {
    if (sequence.length === 0) return
    const token = ++playbackTokenRef.current
    const totalDuration = playNotes(
      sequence.map(({ item }) => ({ stringIndex: item.stringIndex, fret: item.fret })),
      (_position, i) => {
        if (playbackTokenRef.current !== token) return
        setPlayingItem({ lineId: sequence[i].lineId, instanceId: sequence[i].item.instanceId })
      },
      { sort: false },
    )
    window.setTimeout(() => {
      if (playbackTokenRef.current === token) setPlayingItem(null)
    }, totalDuration * 1000)
  }

  const allSequence = lines.flatMap((l) => l.items.map((item) => ({ lineId: l.id, item })))

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
            disabled={allSequence.length === 0}
            onClick={() => playSequence(allSequence)}
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
            <MelodyLineRow
              key={line.id}
              line={line}
              index={i}
              total={lines.length}
              activeInstanceId={playingItem?.lineId === line.id ? playingItem.instanceId : null}
              onPlay={() => playSequence(line.items.map((item) => ({ lineId: line.id, item })))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
