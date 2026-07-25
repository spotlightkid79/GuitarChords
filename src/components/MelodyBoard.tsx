import { useDroppable } from '@dnd-kit/core'
import { useRef, useState } from 'react'
import { playNotes } from '../lib/audio'
import { COMMON_TIME_SIGNATURES, DURATIONS, isNoteEvent, sigLabel, type DurationCode, type MelodyEvent, type NoteEvent } from '../lib/rhythm'
import { lastTimeSignature, useMelodyStore, type MelodyLine } from '../store/melodyStore'
import ExpandToggle from './ExpandToggle'
import StaffView, { type StaffMode } from './StaffView'

export function melodyLineDroppableId(lineId: string) {
  return `melody-line:${lineId}`
}

interface PlayingItem {
  lineId: string
  instanceId: string
}

const SEGMENT_BUTTON =
  'flex h-7 items-center justify-center rounded-md text-xs font-semibold transition-colors disabled:opacity-30'
const SEGMENT_ACTIVE = 'bg-purple-500 text-white shadow-sm shadow-purple-900/40'
const SEGMENT_INACTIVE = 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200'

function SegmentDivider() {
  return <div className="mx-1 h-6 w-px bg-white/10" />
}

/** Simple vector note-duration glyphs — renders identically everywhere, unlike the SMuFL/Unicode
 * music characters (𝅝 𝅗𝅥 ♩ ♪ 𝅘𝅥𝅯), which several OS/browser font combinations render as raw boxes. */
function NoteIcon({ code, dotted = false }: { code: DurationCode; dotted?: boolean }) {
  const hollow = code === 'w' || code === 'h'
  const hasStem = code !== 'w'
  const flagCount = code === '16' ? 2 : code === '8' ? 1 : 0
  return (
    <svg viewBox="0 0 14 22" className="h-5 w-3.5" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(5 17.5) rotate(-16)">
        <ellipse rx="3.1" ry="2.2" fill={hollow ? 'none' : 'currentColor'} stroke="currentColor" strokeWidth={hollow ? 1.4 : 0} />
      </g>
      {hasStem && <line x1="7.9" y1="17" x2="7.9" y2="2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />}
      {flagCount >= 1 && (
        <path d="M7.9 2.5 C10.8 4 11.2 7.2 8.6 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      )}
      {flagCount >= 2 && (
        <path d="M7.9 6.8 C10.8 8.3 11.2 11.5 8.6 13.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      )}
      {dotted && <circle cx="11.3" cy="17.8" r="1" fill="currentColor" />}
    </svg>
  )
}

function RhythmPalette() {
  const { inputDuration, inputDotted, setInputDuration, toggleInputDotted } = useMelodyStore()
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-1">
      {DURATIONS.map((d) => (
        <button
          key={d.code}
          type="button"
          onClick={() => setInputDuration(d.code)}
          title={d.label}
          aria-pressed={inputDuration === d.code}
          className={`${SEGMENT_BUTTON} w-7 ${inputDuration === d.code ? SEGMENT_ACTIVE : SEGMENT_INACTIVE}`}
        >
          <NoteIcon code={d.code} />
        </button>
      ))}
      <SegmentDivider />
      <button
        type="button"
        onClick={toggleInputDotted}
        title="Dotted"
        aria-pressed={inputDotted}
        className={`${SEGMENT_BUTTON} w-7 ${inputDotted ? SEGMENT_ACTIVE : SEGMENT_INACTIVE}`}
      >
        <NoteIcon code="q" dotted />
      </button>
    </div>
  )
}

function MelodyLineRow({
  line,
  index,
  total,
  activeInstanceId,
  onPlay,
  viewMode,
}: {
  line: MelodyLine
  index: number
  total: number
  activeInstanceId: string | null
  onPlay: () => void
  viewMode: StaffMode
}) {
  const { removeItem, removeLine, renameLine, moveLine, addRest, addTimeSignature, inputDuration, inputDotted } =
    useMelodyStore()
  const { setNodeRef, isOver } = useDroppable({ id: melodyLineDroppableId(line.id) })
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(line.name)
  const currentSig = lastTimeSignature(line.items)

  return (
    <div className="flex items-start gap-3">
      <div className="flex w-28 shrink-0 flex-col items-start gap-1.5 pt-2">
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
        <select
          value={sigLabel(currentSig)}
          onChange={(e) => {
            const found = COMMON_TIME_SIGNATURES.find((c) => c.label === e.target.value)
            if (found) addTimeSignature(line.id, found.sig)
          }}
          title="Time signature from here"
          className="w-full rounded border border-white/10 bg-white/10 px-1 py-0.5 text-[10px] text-zinc-300 focus:outline-none focus:ring-1 focus:ring-purple-400"
        >
          {COMMON_TIME_SIGNATURES.map((c) => (
            <option key={c.label} value={c.label}>
              {c.label}
            </option>
          ))}
        </select>
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
            onClick={() => addRest(line.id, { duration: inputDuration, dotted: inputDotted })}
            className="hover:text-purple-300"
            title="Add rest"
          >
            rest
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
        <StaffView
          items={line.items}
          onRemove={(instanceId) => removeItem(line.id, instanceId)}
          activeInstanceId={activeInstanceId}
          mode={viewMode}
        />
      </div>
    </div>
  )
}

export default function MelodyBoard() {
  const { lines, addLine, clearAll } = useMelodyStore()
  const [collapsed, setCollapsed] = useState(false)
  const [viewMode, setViewMode] = useState<StaffMode>('staff')
  const [playingItem, setPlayingItem] = useState<PlayingItem | null>(null)
  const playbackTokenRef = useRef(0)

  function playSequence(sequence: { lineId: string; item: MelodyEvent }[]) {
    const notesOnly = sequence.filter(
      (s): s is { lineId: string; item: NoteEvent } => isNoteEvent(s.item),
    )
    if (notesOnly.length === 0) return
    const token = ++playbackTokenRef.current
    const totalDuration = playNotes(
      notesOnly.map(({ item }) => ({ stringIndex: item.stringIndex, fret: item.fret })),
      (_position, i) => {
        if (playbackTokenRef.current !== token) return
        setPlayingItem({ lineId: notesOnly[i].lineId, instanceId: notesOnly[i].item.instanceId })
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
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Melody</h2>
          <ExpandToggle expanded={!collapsed} onClick={() => setCollapsed((c) => !c)} />
          <SegmentDivider />
          <RhythmPalette />
          <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-1">
            <button
              type="button"
              onClick={() => setViewMode('staff')}
              aria-pressed={viewMode === 'staff'}
              className={`${SEGMENT_BUTTON} px-3 ${viewMode === 'staff' ? SEGMENT_ACTIVE : SEGMENT_INACTIVE}`}
            >
              Staff
            </button>
            <button
              type="button"
              onClick={() => setViewMode('tab')}
              aria-pressed={viewMode === 'tab'}
              className={`${SEGMENT_BUTTON} px-3 ${viewMode === 'tab' ? SEGMENT_ACTIVE : SEGMENT_INACTIVE}`}
            >
              Tab
            </button>
          </div>
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
              viewMode={viewMode}
            />
          ))}
        </div>
      )}
    </div>
  )
}
