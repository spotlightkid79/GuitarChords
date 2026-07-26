import { useMemo, useState } from 'react'
import { CHORDS, type ChordQuality, type ChordShape } from '../data/chords'
import { playChord } from '../lib/audio'
import { extractStanzas, isChordLine, parseChordToken } from '../lib/chordSheetParser'
import type { NoteName } from '../lib/music-theory'
import { useProgressionStore, type BoardLine } from '../store/progressionStore'
import { useSongsStore } from '../store/songsStore'
import { CardBody } from './ChordCard'
import ExpandToggle from './ExpandToggle'

const chordCandidatesByRootQuality = new Map<string, ChordShape[]>()
for (const chord of CHORDS) {
  const key = `${chord.root}-${chord.quality}`
  const list = chordCandidatesByRootQuality.get(key)
  if (list) list.push(chord)
  else chordCandidatesByRootQuality.set(key, [chord])
}

export type VoicingPreference = 'any' | 'open' | 'barre'

/** Narrows candidates to the preferred voicing type, but falls back to the full list when this
 * chord has no shape of that type at all (e.g. Bm has no open shape). */
function filterByPreference(candidates: ChordShape[], preference: VoicingPreference): ChordShape[] {
  if (preference === 'any') return candidates
  const filtered = candidates.filter((c) => (preference === 'open' ? c.voicing === 'open' : c.voicing !== 'open'))
  return filtered.length > 0 ? filtered : candidates
}

/** Picks a single default shape for a root+quality — used for the inline sheet preview, where there's no surrounding sequence to place it near. */
function findChord(root: string, quality: string, preference: VoicingPreference = 'any'): ChordShape | undefined {
  const candidates = chordCandidatesByRootQuality.get(`${root}-${quality}`)
  if (!candidates) return undefined
  return filterByPreference(candidates, preference)[0]
}

/**
 * Picks the voicing for each chord in a sequence that minimizes *total* neck movement across the
 * whole song, not just the jump from the immediately previous chord. A pure greedy "closest to the
 * last chord" choice can look locally reasonable but back itself into a big jump one step later —
 * e.g. given Em(7)→G(?)→A(5), a barre-A G at fret 10 is individually closer to Em(7) (distance 3)
 * than a barre-E G at fret 3 (distance 4), but going on to A(5) afterwards costs 5 more from fret
 * 10 vs only 2 more from fret 3 — fret 3 wins on the full picture (6 total vs 8). This is a
 * classic shortest-path problem, solved here with a small dynamic program over each chord's 1-3
 * candidate voicings (open/barre-E/barre-A).
 */
function pickOptimalVoicings(
  chords: { root: NoteName; quality: ChordQuality }[],
  preference: VoicingPreference,
  startFret: number,
): (ChordShape | undefined)[] {
  if (chords.length === 0) return []

  const candidateLists = chords.map((c) => {
    const all = chordCandidatesByRootQuality.get(`${c.root}-${c.quality}`) ?? []
    return filterByPreference(all, preference)
  })

  // cost[i][j] = minimum total fret movement to reach candidate j of chord i.
  // prev[i][j] = which candidate index of chord i-1 that minimum came from.
  const cost: number[][] = []
  const prev: number[][] = []

  candidateLists.forEach((candidates, i) => {
    cost.push([])
    prev.push([])
    candidates.forEach((candidate, j) => {
      if (i === 0) {
        cost[i][j] = Math.abs(candidate.baseFret - startFret)
        prev[i][j] = -1
        return
      }
      let bestCost = Infinity
      let bestPrev = -1
      candidateLists[i - 1].forEach((prevCandidate, pj) => {
        const c = cost[i - 1][pj] + Math.abs(candidate.baseFret - prevCandidate.baseFret)
        if (c < bestCost) {
          bestCost = c
          bestPrev = pj
        }
      })
      cost[i][j] = bestCost
      prev[i][j] = bestPrev
    })
  })

  const result: (ChordShape | undefined)[] = new Array(chords.length)
  const lastCosts = cost[chords.length - 1]
  let idx = lastCosts.reduce((best, c, j) => (c < lastCosts[best] ? j : best), 0)
  for (let i = chords.length - 1; i >= 0; i--) {
    result[i] = candidateLists[i][idx]
    idx = prev[i][idx]
  }
  return result
}

const PLACEHOLDER = `Bm
Bir derdim var artık tutamam içimde
A
Gitsem nereye kadar kalsam neye yarar
Em
Hiç anlatamadım, hiç anlamadılar`

function ChordSheetLine({ line, preference }: { line: string; preference: VoicingPreference }) {
  if (line.trim().length === 0) return <div className="h-5" />
  if (!isChordLine(line)) {
    return <div className="whitespace-pre text-zinc-700 dark:text-zinc-300">{line}</div>
  }

  const nodes: React.ReactNode[] = []
  let cursor = 0
  for (const match of line.matchAll(/\S+/g)) {
    const token = match[0]
    const start = match.index ?? 0
    if (start > cursor) nodes.push(line.slice(cursor, start))
    const parsed = parseChordToken(token)
    const chord = parsed ? findChord(parsed.root, parsed.quality, preference) : undefined
    if (chord) {
      nodes.push(
        <button
          key={start}
          type="button"
          onClick={() => playChord(chord)}
          className="font-bold text-purple-600 hover:text-purple-700 hover:underline dark:text-purple-400 dark:hover:text-purple-300"
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
  const [songName, setSongName] = useState('Untitled Song')
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [preference, setPreference] = useState<VoicingPreference>('barre')
  const [includeLyrics, setIncludeLyrics] = useState(true)
  const [fullScreenChords, setFullScreenChords] = useState(false)
  const [pasteCollapsed, setPasteCollapsed] = useState(false)

  const stanzas = useMemo(() => extractStanzas(text), [text])
  const allRows = useMemo(() => stanzas.flatMap((s) => s.rows), [stanzas])
  const totalChords = useMemo(() => allRows.reduce((n, r) => n + r.chords.length, 0), [allRows])
  const approximatedCount = useMemo(
    () => allRows.reduce((n, r) => n + r.chords.filter((c) => c.approximated).length, 0),
    [allRows],
  )

  // The actual voicing chosen per chord, shared by the always-visible reference panel and
  // buildBoardLines() below — so what you see on the right is exactly what gets saved.
  // Optimized across the whole song (not per row) so a choice near a line boundary still
  // accounts for what comes right after it.
  const resolvedRows = useMemo(() => {
    const flatChords = allRows.flatMap((r) => r.chords)
    const chosen = pickOptimalVoicings(flatChords, preference, 0)
    let cursor = 0
    return allRows.map((row) => ({
      chords: row.chords.map(() => chosen[cursor++]).filter((c): c is ChordShape => !!c),
      lyrics: row.lyrics,
    }))
  }, [allRows, preference])

  function buildBoardLines(): BoardLine[] {
    return resolvedRows.map((row, i) => ({
      id: crypto.randomUUID(),
      name: `Line ${i + 1}`,
      items: row.chords.map((c) => ({ instanceId: crypto.randomUUID(), chordId: c.id })),
      lyrics: includeLyrics ? row.lyrics || undefined : undefined,
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
    <div className={fullScreenChords ? 'flex flex-col gap-4' : 'grid grid-cols-1 gap-4 lg:grid-cols-[1fr_560px]'}>
      {!fullScreenChords && (
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Lyrics + Chords</h1>
          <p className="text-sm text-zinc-500">
            Paste a chord sheet from the internet (chords on their own line above the lyrics) — recognized chords
            become clickable below.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <ExpandToggle expanded={!pasteCollapsed} onClick={() => setPasteCollapsed((c) => !c)} />
            <button
              type="button"
              onClick={() => setPasteCollapsed((c) => !c)}
              className="text-xs font-medium text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Paste chord sheet
            </button>
            {pasteCollapsed && (
              <span className="text-xs text-zinc-500 dark:text-zinc-600">
                {text.split('\n').length} line{text.split('\n').length === 1 ? '' : 's'} — click to expand
              </span>
            )}
          </div>
          {!pasteCollapsed && (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
              className="h-48 w-full resize-y rounded-lg border border-black/10 bg-black/[0.03] p-3 font-mono text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-purple-400 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
            />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500">Voicing:</span>
          <div className="flex items-center gap-0.5 rounded-lg border border-black/10 bg-black/[0.02] p-1 dark:border-white/10 dark:bg-white/[0.03]">
            {(
              [
                ['any', 'Any'],
                ['open', 'Open'],
                ['barre', 'Barre'],
              ] as [VoicingPreference, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPreference(value)}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  preference === value
                    ? 'bg-purple-500 text-white'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="ml-2 text-xs text-zinc-500">Save:</span>
          <div className="flex items-center gap-0.5 rounded-lg border border-black/10 bg-black/[0.02] p-1 dark:border-white/10 dark:bg-white/[0.03]">
            {(
              [
                [true, 'With lyrics'],
                [false, 'Without lyrics'],
              ] as [boolean, string][]
            ).map(([value, label]) => (
              <button
                key={String(value)}
                type="button"
                onClick={() => setIncludeLyrics(value)}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  includeLyrics === value
                    ? 'bg-purple-500 text-white'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={songName}
            onChange={(e) => {
              setSongName(e.target.value)
              setSavedMessage(null)
            }}
            onFocus={(e) => e.currentTarget.select()}
            placeholder="Song name"
            className="rounded-md border border-black/10 bg-black/[0.03] px-2 py-1 text-xs text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-400 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
          />
          <button
            type="button"
            disabled={totalChords === 0}
            onClick={handleSaveAsSong}
            className="rounded-md bg-purple-500/20 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-500/30 disabled:opacity-40 dark:text-purple-300"
          >
            Save as Song
          </button>
          <button
            type="button"
            disabled={totalChords === 0}
            onClick={handleSendToChords}
            className="text-xs text-zinc-500 hover:text-zinc-700 disabled:opacity-40 dark:hover:text-zinc-300"
          >
            Send to Song board to edit first
          </button>
          <span className="text-xs text-zinc-500">
            {totalChords} chord{totalChords === 1 ? '' : 's'} found across {stanzas.length} section
            {stanzas.length === 1 ? '' : 's'}
          </span>
        </div>
        {savedMessage && <p className="text-xs text-emerald-600 dark:text-emerald-400">✓ {savedMessage}</p>}
        {approximatedCount > 0 && (
          <p className="text-xs text-amber-700/90 dark:text-amber-400/90">
            ⚠ {approximatedCount} chord{approximatedCount === 1 ? '' : 's'} used an approximated shape (sus/add/dim/
            extended chords aren't modeled individually).
          </p>
        )}

        <div className="rounded-lg border border-black/10 bg-zinc-100 p-4 font-mono text-sm leading-6 dark:border-white/10 dark:bg-[#14151b]">
          {text.split('\n').map((line, i) => (
            <ChordSheetLine key={i} line={line} preference={preference} />
          ))}
        </div>
      </div>
      )}

      <div
        className={
          fullScreenChords
            ? 'flex flex-col gap-4'
            : 'flex flex-col gap-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto'
        }
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-zinc-500">Chords in this sheet, line by line — click any chord to hear it.</p>
          <button
            type="button"
            onClick={() => setFullScreenChords((v) => !v)}
            className="shrink-0 rounded-md border border-black/10 px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-black/5 hover:text-zinc-800 dark:border-white/10 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200"
          >
            {fullScreenChords ? '✕ Show sheet' : '⤢ Full screen'}
          </button>
        </div>
        {resolvedRows.length === 0 ? (
          <p className="text-center text-xs text-zinc-500 dark:text-zinc-600">
            Paste a chord sheet on the left to see chords here.
          </p>
        ) : (
          <div
            className={
              fullScreenChords ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'flex flex-col gap-4'
            }
          >
            {resolvedRows.map((row, i) => (
              <div
                key={i}
                className={
                  fullScreenChords
                    ? 'flex flex-col gap-1.5 rounded-lg border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.02]'
                    : 'flex flex-col gap-1.5 border-b border-black/5 pb-4 last:border-0 dark:border-white/5'
                }
              >
                <div className="flex flex-wrap gap-2">
                  {row.chords.map((chord, j) => (
                    <button key={j} type="button" onClick={() => playChord(chord)} className="text-left">
                      <CardBody chord={chord} />
                    </button>
                  ))}
                </div>
                {row.lyrics && <p className="text-xs italic text-zinc-500">{row.lyrics}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
