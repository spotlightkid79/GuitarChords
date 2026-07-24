import { useDroppable } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { CHORDS } from '../data/chords'
import { useProgressionStore } from '../store/progressionStore'
import { BoardChordCard } from './ChordCard'

const chordById = new Map(CHORDS.map((c) => [c.id, c]))

export const BOARD_DROPPABLE_ID = 'progression-board'

export default function ProgressionBoard() {
  const { items, removeItem, clear } = useProgressionStore()
  const { setNodeRef, isOver } = useDroppable({ id: BOARD_DROPPABLE_ID })

  return (
    <div className="border-t border-white/10 bg-[#14151b]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 pt-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Progression Board
        </h2>
        {items.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="text-xs text-zinc-500 hover:text-red-400"
          >
            Clear all
          </button>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={`mx-auto flex min-h-[9.5rem] max-w-6xl flex-wrap items-start gap-3 overflow-y-auto p-4 transition-colors ${
          isOver ? 'bg-purple-500/10' : ''
        }`}
      >
        {items.length === 0 ? (
          <p className="m-auto text-sm text-zinc-500">
            Drag chords here from the library to build a progression.
          </p>
        ) : (
          <SortableContext items={items.map((i) => i.instanceId)} strategy={horizontalListSortingStrategy}>
            {items.map((item) => {
              const chord = chordById.get(item.chordId)
              if (!chord) return null
              return (
                <BoardChordCard
                  key={item.instanceId}
                  instanceId={item.instanceId}
                  chord={chord}
                  onRemove={() => removeItem(item.instanceId)}
                />
              )
            })}
          </SortableContext>
        )}
      </div>
    </div>
  )
}
