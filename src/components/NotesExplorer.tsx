import { useState } from 'react'
import { ALL_ROOTS, type NoteName } from '../lib/music-theory'
import Fretboard from './Fretboard'

export default function NotesExplorer() {
  const [highlightNote, setHighlightNote] = useState<NoteName | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-500">Highlight:</span>
        <button
          type="button"
          onClick={() => setHighlightNote(null)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            highlightNote === null
              ? 'bg-purple-500/20 text-purple-300'
              : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200'
          }`}
        >
          All notes
        </button>
        {ALL_ROOTS.map((note) => (
          <button
            key={note}
            type="button"
            onClick={() => setHighlightNote(note)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              highlightNote === note
                ? 'bg-purple-500/20 text-purple-300'
                : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200'
            }`}
          >
            {note}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-zinc-100">
          {highlightNote ? `Fretboard notes — ${highlightNote} highlighted` : 'Fretboard notes'}
        </h2>
        <div className="w-full overflow-x-auto rounded-lg border border-white/10 bg-white/5 p-3">
          <Fretboard mode="notes" highlightNote={highlightNote} />
        </div>
      </div>
    </div>
  )
}
