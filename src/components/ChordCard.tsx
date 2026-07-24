import { useDraggable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ChordShape } from '../data/chords'
import Fretboard from './Fretboard'

function CardBody({ chord }: { chord: ChordShape }) {
  return (
    <div className="flex w-32 flex-col items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-2">
      <div className="h-32 w-full">
        <Fretboard mode="chord" chord={chord} />
      </div>
      <div className="text-sm font-semibold text-zinc-100">{chord.label}</div>
      <div className="text-[11px] text-zinc-400">{chord.qualityName}</div>
    </div>
  )
}

/** Draggable chord card used inside the chord library — drag it onto the progression board. */
export function LibraryChordCard({ chord }: { chord: ChordShape }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `lib:${chord.id}`,
    data: { source: 'library', chordId: chord.id },
  })

  return (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`cursor-grab touch-none text-left active:cursor-grabbing ${isDragging ? 'opacity-40' : ''}`}
    >
      <CardBody chord={chord} />
    </button>
  )
}

/** Sortable chord card placed on the progression board — can be reordered or removed. */
export function BoardChordCard({
  instanceId,
  chord,
  onRemove,
}: {
  instanceId: string
  chord: ChordShape
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: instanceId,
    data: { source: 'board' },
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
        aria-label={`Remove ${chord.label}`}
        className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-700 text-xs leading-none text-zinc-200 hover:bg-red-500/80"
      >
        ×
      </button>
      <div className="cursor-grab active:cursor-grabbing" {...listeners} {...attributes}>
        <CardBody chord={chord} />
      </div>
    </div>
  )
}
