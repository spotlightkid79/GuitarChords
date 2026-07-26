import { useDroppable } from '@dnd-kit/core'
import { useRef, useState, type ChangeEvent } from 'react'
import { playNotes } from '../lib/audio'
import { importMultipleFiles, summarizeImport } from '../lib/importFiles'
import { downloadAllMelodies, downloadMelody, parseMelodyFile } from '../lib/melodyFile'
import { COMMON_TIME_SIGNATURES, DURATIONS, isNoteEvent, sigLabel, type DurationCode, type MelodyEvent, type NoteEvent } from '../lib/rhythm'
import { useMelodiesStore } from '../store/melodiesStore'
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
const SEGMENT_INACTIVE = 'text-zinc-500 hover:bg-black/5 hover:text-zinc-800 dark:hover:bg-white/5 dark:hover:text-zinc-200'

function SegmentDivider() {
  return <div className="mx-1 h-6 w-px bg-black/10 dark:bg-white/10" />
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
    <div className="flex items-center gap-0.5 rounded-lg border border-black/10 bg-black/[0.02] p-1 dark:border-white/10 dark:bg-white/[0.03]">
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
            className="w-full rounded border border-black/10 bg-black/5 px-1.5 py-0.5 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-purple-400 dark:border-white/10 dark:bg-white/10 dark:text-zinc-100"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraftName(line.name)
              setEditing(true)
            }}
            className="truncate text-left text-xs font-semibold text-zinc-700 hover:text-purple-600 dark:text-zinc-300 dark:hover:text-purple-300"
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
          className="w-full rounded border border-black/10 bg-black/5 px-1 py-0.5 text-[10px] text-zinc-700 focus:outline-none focus:ring-1 focus:ring-purple-400 dark:border-white/10 dark:bg-white/10 dark:text-zinc-300"
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
            className="hover:text-purple-600 disabled:opacity-30 dark:hover:text-purple-300"
            aria-label="Play line"
            title="Play line"
          >
            ▶
          </button>
          <button
            type="button"
            onClick={() => addRest(line.id, { duration: inputDuration, dotted: inputDotted })}
            className="hover:text-purple-600 dark:hover:text-purple-300"
            title="Add rest"
          >
            rest
          </button>
          <button
            type="button"
            disabled={index === 0}
            onClick={() => moveLine(line.id, -1)}
            className="hover:text-zinc-700 disabled:opacity-30 dark:hover:text-zinc-300"
            aria-label="Move line up"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => moveLine(line.id, 1)}
            className="hover:text-zinc-700 disabled:opacity-30 dark:hover:text-zinc-300"
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
        className={`relative flex min-h-[5.5rem] flex-1 items-center overflow-x-auto rounded-lg border border-black/5 p-2 transition-colors dark:border-white/5 ${
          isOver ? 'bg-purple-500/10' : ''
        }`}
      >
        {line.items.length === 0 && (
          <p className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-xs text-zinc-500 dark:text-zinc-600">
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

function MelodyControls() {
  const { lines, setLines, clearAll } = useMelodyStore()
  const { melodies, activeMelodyId, saveAsNew, updateExisting, renameMelody, deleteMelody, setActive } =
    useMelodiesStore()
  const activeMelody = melodies.find((m) => m.id === activeMelodyId) ?? null
  const [name, setName] = useState(activeMelody?.name ?? 'Untitled Melody')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleSave() {
    const trimmed = name.trim() || 'Untitled Melody'
    if (activeMelody) {
      updateExisting(activeMelody.id, lines)
      if (trimmed !== activeMelody.name) renameMelody(activeMelody.id, trimmed)
    } else {
      saveAsNew(trimmed, lines)
    }
  }

  function handleNew() {
    clearAll()
    setActive(null)
    setName('Untitled Melody')
  }

  function handleLoad(id: string) {
    const melody = melodies.find((m) => m.id === id)
    if (!melody) return
    setLines(melody.lines)
    setActive(melody.id)
    setName(melody.name)
  }

  function handleDelete() {
    if (!activeMelody) return
    if (!window.confirm(`Delete "${activeMelody.name}"? This can't be undone.`)) return
    deleteMelody(activeMelody.id)
    clearAll()
    setName('Untitled Melody')
  }

  function handleExportCurrent() {
    downloadMelody(name.trim() || 'Untitled Melody', lines)
  }

  function handleExportAll() {
    if (melodies.length === 0) return
    downloadAllMelodies(melodies)
  }

  function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    // Copy out of the live FileList before resetting e.target.value — clearing the input's value
    // also empties that same FileList object, not just future reads of it.
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    importMultipleFiles(files, parseMelodyFile).then((result) => {
      result.imported.forEach((m) => saveAsNew(m.name, m.lines))
      window.alert(summarizeImport(result, 'melody'))
    })
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 pb-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        placeholder="Melody name"
        className="rounded-md border border-black/10 bg-black/[0.03] px-2 py-1 text-xs text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-400 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
      />
      <button
        type="button"
        onClick={handleSave}
        className="rounded-md bg-purple-500/20 px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-500/30 dark:text-purple-300"
      >
        {activeMelody ? 'Save' : 'Save as new melody'}
      </button>
      <button
        type="button"
        onClick={handleNew}
        className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        New melody
      </button>

      {melodies.length > 0 && (
        <>
          <select
            value={activeMelodyId ?? ''}
            onChange={(e) => handleLoad(e.target.value)}
            className="rounded-md border border-black/10 bg-black/[0.03] px-2 py-1 text-xs text-zinc-900 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
          >
            <option value="" disabled>
              Load a saved melody…
            </option>
            {melodies.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {activeMelody && (
            <button type="button" onClick={handleDelete} className="text-xs text-zinc-500 hover:text-red-400">
              Delete
            </button>
          )}
        </>
      )}

      <span className="mx-1 h-4 w-px bg-black/10 dark:bg-white/10" aria-hidden="true" />

      <button
        type="button"
        onClick={handleExportCurrent}
        className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        Export current
      </button>
      {melodies.length > 0 && (
        <button
          type="button"
          onClick={handleExportAll}
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Export all
        </button>
      )}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        title="You can select multiple files at once"
        className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        Import…
      </button>
      <input ref={fileInputRef} type="file" accept="application/json" multiple onChange={handleImportFile} className="hidden" />
    </div>
  )
}

export default function MelodyBoard() {
  const { lines, addLine, clearAll } = useMelodyStore()
  const activeMelodyId = useMelodiesStore((s) => s.activeMelodyId)
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
    <div className="border-t border-black/10 bg-zinc-100 dark:border-white/10 dark:bg-[#14151b]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 pt-2">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Melody</h2>
          <ExpandToggle expanded={!collapsed} onClick={() => setCollapsed((c) => !c)} />
          <SegmentDivider />
          <RhythmPalette />
          <div className="flex items-center gap-0.5 rounded-lg border border-black/10 bg-black/[0.02] p-1 dark:border-white/10 dark:bg-white/[0.03]">
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
            className="text-xs font-medium text-purple-600 hover:text-purple-700 disabled:opacity-30 dark:text-purple-300 dark:hover:text-purple-200"
          >
            ▶ Play melody
          </button>
          <button
            type="button"
            onClick={addLine}
            className="text-xs font-medium text-purple-600 hover:text-purple-700 dark:text-purple-300 dark:hover:text-purple-200"
          >
            + Add line
          </button>
          <button type="button" onClick={clearAll} className="text-xs text-zinc-500 hover:text-red-400">
            Clear all
          </button>
        </div>
      </div>

      <MelodyControls key={activeMelodyId ?? 'new'} />

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
