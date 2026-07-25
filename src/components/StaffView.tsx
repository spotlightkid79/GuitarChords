import { useEffect, useRef } from 'react'
import { Accidental, Formatter, Renderer, Stave, StaveNote } from 'vexflow'
import { midiAtFret, midiToNoteName, midiToOctave } from '../lib/music-theory'
import type { MelodyNoteItem } from '../store/melodyStore'

// Guitar is a transposing instrument: written notation is conventionally one octave above
// the sounding pitch, which keeps everyday guitar range close to the staff instead of
// needing a huge stack of ledger lines below it.
const WRITTEN_OCTAVE_OFFSET = 12

function vexKey(soundingMidi: number): string {
  const writtenMidi = soundingMidi + WRITTEN_OCTAVE_OFFSET
  const note = midiToNoteName(writtenMidi)
  const octave = midiToOctave(writtenMidi)
  const letter = note[0].toLowerCase()
  const accidental = note.includes('#') ? '#' : ''
  return `${letter}${accidental}/${octave}`
}

export default function StaffView({
  items,
  onRemove,
}: {
  items: MelodyNoteItem[]
  onRemove?: (instanceId: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.innerHTML = ''

    const width = Math.max(260, 60 + items.length * 60)
    const height = 210
    const staveY = 60

    const renderer = new Renderer(container, Renderer.Backends.SVG)
    renderer.resize(width, height)
    const context = renderer.getContext()
    context.setFillStyle('#e8e8ec')
    context.setStrokeStyle('#e8e8ec')

    const stave = new Stave(10, staveY, width - 20)
    stave.addClef('treble')
    stave.setContext(context).draw()

    if (items.length === 0) return

    const staveNotes = items.map((item) => {
      const midi = midiAtFret(item.stringIndex, item.fret)
      const key = vexKey(midi)
      const note = new StaveNote({ keys: [key], duration: 'q' })
      if (key.includes('#')) {
        note.addModifier(new Accidental('#'))
      }
      return note
    })

    Formatter.FormatAndDraw(context, stave, staveNotes)

    if (onRemove) {
      staveNotes.forEach((note, i) => {
        const el = note.getSVGElement()
        if (!el) return
        el.style.cursor = 'pointer'
        el.addEventListener('click', () => onRemove(items[i].instanceId))
      })
    }
  }, [items, onRemove])

  return <div ref={containerRef} className="overflow-x-auto" />
}
