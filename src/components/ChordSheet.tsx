import { useMemo, useState } from 'react'
import { CHORDS, type ChordShape } from '../data/chords'
import { playChord } from '../lib/audio'
import { extractStanzas, isChordLine, parseChordToken } from '../lib/chordSheetParser'
import { useProgressionStore, type BoardLine } from '../store/progressionStore'
import { useSongsStore } from '../store/songsStore'
import { CardBody } from './ChordCard'

const chordCandidatesByRootQuality = new Map<string, ChordShape[]>()
for (const chord of CHORDS) {
  const key = `${chord.root}-${chord.quality}`
  const list = chordCandidatesByRootQuality.get(key)
  if (list) list.push(chord)
  else chordCandidatesByRootQuality.set(key, [chord])
}

/** Picks a single default shape for a root+quality — used for the inline sheet preview, where there's no surrounding sequence to place it near. */
function findChord(root: string, quality: string): ChordShape | undefined {
  return chordCandidatesByRootQuality.get(`${root}-${quality}`)?.[0]
}

/** Among every voicing available for this root+quality (open, barre-E, barre-A), picks whichever sits closest on the neck to `nearFret` — keeps a chord sequence from jumping around the fretboard when a closer voicing of the same chord exists. */
function findClosestChord(root: string, quality: string, nearFret: number): ChordShape | undefined {
  const candidates = chordCandidatesByRootQuality.get(`${root}-${quality}`)
  if (!candidates || candidates.length === 0) return undefined
  return candidates.reduce((best, c) => (Math.abs(c.baseFret - nearFret) < Math.abs(best.baseFret - nearFret) ? c : best))
}

const PLACEHOLDER = `Bm
Bir derdim var artık tutamam içimde
A
Gitsem nereye kadar kalsam neye yarar
Em
Hiç anlatamadım, hiç anlamadılar`

function ChordSheetLine({ line, onSelect }: { line: string; onSelect: (chord: ChordShape) => void }) {
  if (line.trim().length === 0) return <div className="h-5" />
  if (!isChordLine(line)) {
    return <div className="whitespace-pre text-zinc-300">{line}</div>
  }

  const nodes: React.ReactNode[] = []
  let cursor = 0
  for (const match of line.matchAll(/\S+/g)) {
    const token = match[0]
    const start = match.index ?? 0
    if (start > cursor) nodes.push(line.slice(cursor, start))
    const parsed = parseChordToken(token)
    const chord = parsed ? findChord(parsed.root, parsed.quality) : undefined
    if (chord) {
      nodes.push(
        <button
          key={start}
          type="button"
          onClick={() => {
            playChord(chord)
            onSelect(chord)
          }}
          className="font-bold text-purple-400 hover:text-purple-300 hover:underline"
        >
          {token}
        </button>,
      )
    } else {
      nodes.push(token)
    }
    cursor = start + token.length
  }
  if (cursor < line.length) nodes.push(line.slice(cursor))

  return <div className="whitespace-pre">{nodes}</div>
}

export default function ChordSheet({ onSendToChords }: { onSendToChords: () => void }) {
  const [text, setText] = useState(PLACEHOLDER)
  const [selected, setSelected] = useState<ChordShape | null>(null)
  const [songName, setSongName] = useState('Untitled Song')
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  const stanzas = useMemo(() => extractStanzas(text), [text])
  const totalChords = useMemo(() => stanzas.reduce((n, s) => n + s.chords.length, 0), [stanzas])
  const approximatedCount = useMemo(
    () => stanzas.reduce((n, s) => n + s.chords.filter((c) => c.approximated).length, 0),
    [stanzas],
  )

  function buildBoardLines(): BoardLine[] {
    // Tracks the neck position of the last-picked chord across the whole song (not reset per
    // stanza) so consecutive chords favor whichever voicing keeps the hand near where it already
    // is, instead of e.g. jumping to a barre-A shape at fret 10 when a barre-E at fret 3 exists.
    let currentFret = 0
    return stanzas.map((stanza, i) => ({
      id: crypto.randomUUID(),
      name: `Line ${i + 1}`,
      items: stanza.chords
        .map((c) => {
          const chord = findClosestChord(c.root, c.quality, currentFret)
          if (chord) currentFret = chord.baseFret
          return chord
        })
        .filter((c): c is ChordShape => !!c)
        .map((c) => ({ instanceId: crypto.randomUUID(), chordId: c.id })),
    }))
  }

  function handleSendToChords() {
    useProgressionStore.getState().setLines(buildBoardLines())
    useSongsStore.getState().setActive(null)
    onSendToChords()
  }

  function handleSaveAsSong() {
    const trimmed = songName.trim() || 'Untitled Song'
    useSongsStore.getState().saveAsNew(trimmed, buildBoardLines())
    setSavedMessage(`Saved as "${trimmed}" — find it in the Songs tab.`)
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Lyrics + Chords</h1>
          <p className="text-sm text-zinc-500">
            Paste a chord sheet from the internet (chords on their own line above the lyrics) — recognized chords
            become clickable below.
          </p>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          className="h-48 w-full resize-y rounded-lg border border-white/10 bg-white/5 p-3 font-mono text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-purple-400"
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={songName}
            onChange={(e) => {
              setSongName(e.target.value)
              setSavedMessage(null)
            }}
            onFocus={(e) => e.currentTarget.select()}
            placeholder="Song name"
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-400"
          />
          <button
            type="button"
            disabled={totalChords === 0}
            onClick={handleSaveAsSong}
            className="rounded-md bg-purple-500/20 px-3 py-1.5 text-xs font-medium text-purple-300 hover:bg-purple-500/30 disabled:opacity-40"
          >
            Save as Song
          </button>
          <button
            type="button"
            disabled={totalChords === 0}
            onClick={handleSendToChords}
            className="text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-40"
          >
            Send to Song board to edit first
          </button>
          <span className="text-xs text-zinc-500">
            {totalChords} chord{totalChords === 1 ? '' : 's'} found across {stanzas.length} section
            {stanzas.length === 1 ? '' : 's'}
          </span>
        </div>
        {savedMessage && <p className="text-xs text-emerald-400">✓ {savedMessage}</p>}
        {approximatedCount > 0 && (
          <p className="text-xs text-amber-400/90">
            ⚠ {approximatedCount} chord{approximatedCount === 1 ? '' : 's'} used an approximated shape (sus/add/dim/
            extended chords aren't modeled individually).
          </p>
        )}

        <div className="rounded-lg border border-white/10 bg-[#14151b] p-4 font-mono text-sm leading-6">
          {text.split('\n').map((line, i) => (
            <ChordSheetLine key={i} line={line} onSelect={setSelected} />
          ))}
        </div>
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start">
        {selected ? (
          <div className="flex flex-col items-center gap-2">
            <CardBody chord={selected} />
            <p className="text-center text-xs text-zinc-500">Click any chord in the sheet to preview and hear it.</p>
          </div>
        ) : (
          <p className="text-center text-xs text-zinc-500">Click any chord in the sheet to preview and hear it.</p>
        )}
      </div>
    </div>
  )
}
