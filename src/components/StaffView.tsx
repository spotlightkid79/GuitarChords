import { useEffect, useRef } from 'react'
import { Accidental, Formatter, Renderer, Stave, StaveNote, TabNote, TabStave } from 'vexflow'
import { midiAtFret, midiToNoteName, midiToOctave } from '../lib/music-theory'
import type { MelodyNoteItem } from '../store/melodyStore'

// Guitar is a transposing instrument: written notation is conventionally one octave above
// the sounding pitch, which keeps everyday guitar range close to the staff instead of
// needing a huge stack of ledger lines below it.
const WRITTEN_OCTAVE_OFFSET = 12
const ACTIVE_COLOR = '#fbbf24'
const STRING_COUNT = 6

function vexKey(soundingMidi: number): string {
  const writtenMidi = soundingMidi + WRITTEN_OCTAVE_OFFSET
  const note = midiToNoteName(writtenMidi)
  const octave = midiToOctave(writtenMidi)
  const letter = note[0].toLowerCase()
  const accidental = note.includes('#') ? '#' : ''
  return `${letter}${accidental}/${octave}`
}

export type StaffMode = 'staff' | 'tab'

export default function StaffView({
  items,
  onRemove,
  activeInstanceId = null,
  mode = 'staff',
}: {
  items: MelodyNoteItem[]
  onRemove?: (instanceId: string) => void
  activeInstanceId?: string | null
  mode?: StaffMode
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.innerHTML = ''

    const width = Math.max(260, 60 + items.length * 60)
    const height = mode === 'tab' ? 140 : 210
    const staveY = mode === 'tab' ? 20 : 60

    const renderer = new Renderer(container, Renderer.Backends.SVG)
    renderer.resize(width, height)
    const context = renderer.getContext()
    context.setFillStyle('#e8e8ec')
    context.setStrokeStyle('#e8e8ec')

    const stave = mode === 'tab' ? new TabStave(10, staveY, width - 20) : new Stave(10, staveY, width - 20)
    stave.addClef(mode === 'tab' ? 'tab' : 'treble')
    stave.setContext(context).draw()

    if (items.length === 0) return

    const notes = items.map((item) => {
      const isActive = item.instanceId === activeInstanceId
      const activeStyle = { fillStyle: ACTIVE_COLOR, strokeStyle: ACTIVE_COLOR }

      if (mode === 'tab') {
        const tabString = STRING_COUNT - item.stringIndex
        const tabNote = new TabNote({ positions: [{ str: tabString, fret: item.fret }], duration: 'q' })
        if (isActive) tabNote.setStyle(activeStyle)
        return tabNote
      }

      const midi = midiAtFret(item.stringIndex, item.fret)
      const key = vexKey(midi)
      const staveNote = new StaveNote({ keys: [key], duration: 'q' })
      if (key.includes('#')) {
        const accidental = new Accidental('#')
        if (isActive) accidental.setStyle(activeStyle)
        staveNote.addModifier(accidental)
      }
      if (isActive) staveNote.setStyle(activeStyle)
      return staveNote
    })

    Formatter.FormatAndDraw(context, stave, notes)

    if (mode === 'tab') {
      // VexFlow draws each fret number on a small opaque white "clear" rect over the tab
      // line, sized for its own tiny default font. We swap in a bigger, legible font, so the
      // rect (still sized for the old glyph) needs resizing to match, and both need colors
      // that work against our dark background instead of assuming a white page.
      notes.forEach((note, i) => {
        const el = note.getSVGElement()
        if (!el) return
        const isActive = items[i].instanceId === activeInstanceId
        const text = el.querySelector('text')
        const rect = el.querySelector('rect')
        if (!text) return
        text.setAttribute('font-family', 'system-ui, sans-serif')
        text.setAttribute('font-size', '13px')
        text.setAttribute('font-weight', '700')
        text.setAttribute('fill', isActive ? ACTIVE_COLOR : '#e8e8ec')
        if (rect) {
          const bbox = text.getBBox()
          rect.setAttribute('x', String(bbox.x - 2))
          rect.setAttribute('y', String(bbox.y - 2))
          rect.setAttribute('width', String(bbox.width + 4))
          rect.setAttribute('height', String(bbox.height + 4))
          rect.setAttribute('fill', '#14151b')
        }
      })
    }

    if (onRemove) {
      notes.forEach((note, i) => {
        const el = note.getSVGElement()
        if (!el) return
        el.style.cursor = 'pointer'
        el.addEventListener('click', () => onRemove(items[i].instanceId))
      })
    }
  }, [items, onRemove, activeInstanceId, mode])

  return <div ref={containerRef} className="overflow-x-auto" />
}
