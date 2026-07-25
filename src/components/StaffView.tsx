import { useEffect, useRef } from 'react'
import { Accidental, Formatter, Renderer, Stave, StaveNote } from 'vexflow'
import { midiAtFret, midiToNoteName, midiToOctave } from '../lib/music-theory'
import type { MelodyNoteItem } from '../store/melodyStore'

function vexKey(midi: number): string {
  const note = midiToNoteName(midi)
  const octave = midiToOctave(midi)
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
    const height = 130

    const renderer = new Renderer(container, Renderer.Backends.SVG)
    renderer.resize(width, height)
    const context = renderer.getContext()
    context.setFillStyle('#e8e8ec')
    context.setStrokeStyle('#e8e8ec')

    const stave = new Stave(10, 10, width - 20)
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
