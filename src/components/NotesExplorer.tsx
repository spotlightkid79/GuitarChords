import { useRef, useState } from 'react'
import { playNotes, type FretPosition } from '../lib/audio'
import { ALL_ROOTS, STANDARD_TUNING, noteAtFret, type NoteName } from '../lib/music-theory'
import Fretboard from './Fretboard'

const FRET_COUNT = 12

function positionsForNote(note: NoteName) {
  const positions: FretPosition[] = []
  STANDARD_TUNING.forEach((openNote, stringIndex) => {
    for (let fret = 0; fret <= FRET_COUNT; fret++) {
      if (noteAtFret(openNote, fret) === note) positions.push({ stringIndex, fret })
    }
  })
  return positions
}

export default function NotesExplorer() {
  const [highlightNote, setHighlightNote] = useState<NoteName | null>(null)
  const [playingPosition, setPlayingPosition] = useState<FretPosition | null>(null)
  const playbackTokenRef = useRef(0)

  const toggleNote = (note: NoteName) =>
    setHighlightNote((current) => (current === note ? null : note))

  const playSequence = (positions: FretPosition[]) => {
    const token = ++playbackTokenRef.current
    const totalDuration = playNotes(positions, (position) => {
      if (playbackTokenRef.current === token) setPlayingPosition(position)
    })
    window.setTimeout(() => {
      if (playbackTokenRef.current === token) setPlayingPosition(null)
    }, totalDuration * 1000)
  }

  // Clicking a note letter above (next to "Highlight:") rings every matching note, one by one.
  const handleHighlightClick = (note: NoteName) => {
    toggleNote(note)
    playSequence(positionsForNote(note))
  }

  // Clicking a specific dot on the fretboard rings just that one note.
  const handleFretboardClick = (note: NoteName, stringIndex: number, fret: number) => {
    toggleNote(note)
    playSequence([{ stringIndex, fret }])
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-500">Highlight:</span>
        <button
          type="button"
          onClick={() => setHighlightNote(null)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            highlightNote === null
              ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300'
              : 'bg-black/[0.03] text-zinc-600 hover:bg-black/10 hover:text-zinc-800 dark:bg-white/5 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-200'
          }`}
        >
          All notes
        </button>
        {ALL_ROOTS.map((note) => (
          <button
            key={note}
            type="button"
            onClick={() => handleHighlightClick(note)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              highlightNote === note
                ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300'
                : 'bg-black/[0.03] text-zinc-600 hover:bg-black/10 hover:text-zinc-800 dark:bg-white/5 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-200'
            }`}
          >
            {note}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {highlightNote ? `Fretboard notes — ${highlightNote} highlighted` : 'Fretboard notes'}
        </h2>
        <p className="text-xs text-zinc-500">
          Click a note above to hear every matching note play one by one, or click a note on the fretboard to ring
          just that one — click a selected note again to clear.
        </p>
        <div className="w-full overflow-x-auto rounded-lg border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/5">
          <Fretboard
            mode="notes"
            highlightNote={highlightNote}
            onNoteClick={handleFretboardClick}
            playingPosition={playingPosition}
          />
        </div>
      </div>
    </div>
  )
}
