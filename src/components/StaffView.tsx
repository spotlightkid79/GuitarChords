import { useEffect, useRef } from 'react'
import {
  Accidental,
  Dot,
  Formatter,
  GhostNote,
  Renderer,
  Stave,
  StaveNote,
  StaveTie,
  TabNote,
  TabStave,
  type StemmableNote,
} from 'vexflow'
import { midiAtFret, midiToNoteName, midiToOctave } from '../lib/music-theory'
import { layoutMeasures, sigLabel, type LayoutPiece, type MelodyEvent } from '../lib/rhythm'
import { useThemeStore } from '../store/themeStore'

// Guitar is a transposing instrument: written notation is conventionally one octave above
// the sounding pitch, which keeps everyday guitar range close to the staff instead of
// needing a huge stack of ledger lines below it.
const WRITTEN_OCTAVE_OFFSET = 12
const ACTIVE_COLOR = '#fbbf24'

// VexFlow colors are set explicitly in code (canvas/SVG drawing, not CSS), so they need their
// own light/dark pair here rather than a Tailwind `dark:` class.
const PALETTE = {
  dark: { default: '#e8e8ec', autoRest: '#4b4b57', tabRectBg: '#14151b' },
  light: { default: '#27272a', autoRest: '#a1a1aa', tabRectBg: '#f4f4f6' },
}

const STRING_COUNT = 6
const REST_KEY = 'b/4'

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
  items: MelodyEvent[]
  onRemove?: (instanceId: string) => void
  activeInstanceId?: string | null
  mode?: StaffMode
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const theme = useThemeStore((s) => s.theme)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.innerHTML = ''

    const { default: DEFAULT_COLOR, autoRest: AUTO_REST_COLOR, tabRectBg: TAB_RECT_BG } = PALETTE[theme]
    const DEFAULT_STYLE = { fillStyle: DEFAULT_COLOR, strokeStyle: DEFAULT_COLOR }

    const measures = layoutMeasures(items)
    const height = mode === 'tab' ? 140 : 210
    const staveY = mode === 'tab' ? 20 : 60
    const measureWidths = measures.map((m, i) => {
      let w = Math.max(90, 40 + m.pieces.length * 55)
      if (i === 0) w += 30
      if (m.showTimeSignature) w += 30
      return w
    })
    const totalWidth = measureWidths.reduce((a, b) => a + b, 0) + 20

    const renderer = new Renderer(container, Renderer.Backends.SVG)
    renderer.resize(totalWidth, height)
    const context = renderer.getContext()
    context.setFillStyle(DEFAULT_COLOR)
    context.setStrokeStyle(DEFAULT_COLOR)

    const flatNotes: { el: StemmableNote; piece: LayoutPiece }[] = []
    let x = 10

    measures.forEach((measure, i) => {
      const stave = mode === 'tab' ? new TabStave(x, staveY, measureWidths[i]) : new Stave(x, staveY, measureWidths[i])
      stave.setStyle(DEFAULT_STYLE)
      stave.setDefaultLedgerLineStyle({ strokeStyle: DEFAULT_COLOR, lineWidth: 1 })
      if (i === 0) stave.addClef(mode === 'tab' ? 'tab' : 'treble')
      if (measure.showTimeSignature && mode === 'staff') stave.addTimeSignature(sigLabel(measure.sig))
      stave.setContext(context).draw()
      x += measureWidths[i]

      const vexNotes = measure.pieces.map((piece) => {
        const isActive = piece.sourceInstanceId === activeInstanceId
        const activeStyle = { fillStyle: ACTIVE_COLOR, strokeStyle: ACTIVE_COLOR }
        const dimStyle = { fillStyle: AUTO_REST_COLOR, strokeStyle: AUTO_REST_COLOR }

        if (mode === 'tab') {
          if (piece.kind === 'rest') {
            return new GhostNote({ duration: piece.duration })
          }
          const tabString = STRING_COUNT - (piece.stringIndex ?? 0)
          const tabNote = new TabNote({ positions: [{ str: tabString, fret: piece.fret ?? 0 }], duration: piece.duration })
          if (piece.dotted) Dot.buildAndAttach([tabNote], { all: true })
          tabNote.setStyle(isActive ? activeStyle : DEFAULT_STYLE)
          return tabNote
        }

        if (piece.kind === 'rest') {
          const restNote = new StaveNote({ keys: [REST_KEY], duration: `${piece.duration}r` })
          if (piece.dotted) Dot.buildAndAttach([restNote], { all: true })
          restNote.setStyle(piece.autoInserted ? dimStyle : isActive ? activeStyle : DEFAULT_STYLE)
          return restNote
        }

        const midi = midiAtFret(piece.stringIndex ?? 0, piece.fret ?? 0)
        const key = vexKey(midi)
        const staveNote = new StaveNote({ keys: [key], duration: piece.duration })
        if (key.includes('#')) {
          const accidental = new Accidental('#')
          accidental.setStyle(isActive ? activeStyle : DEFAULT_STYLE)
          staveNote.addModifier(accidental)
        }
        if (piece.dotted) Dot.buildAndAttach([staveNote], { all: true })
        staveNote.setStyle(isActive ? activeStyle : DEFAULT_STYLE)
        return staveNote
      })

      if (vexNotes.length > 0) Formatter.FormatAndDraw(context, stave, vexNotes)

      if (mode === 'tab') {
        // VexFlow draws each fret number on a small opaque white "clear" rect over the tab
        // line, sized for its own tiny default font. We swap in a bigger, legible font, so the
        // rect (still sized for the old glyph) needs resizing to match, and both need colors
        // that work against our dark background instead of assuming a white page.
        vexNotes.forEach((note, ni) => {
          const el = note.getSVGElement()
          if (!el) return
          const piece = measure.pieces[ni]
          const isActive = piece.sourceInstanceId === activeInstanceId
          const text = el.querySelector('text')
          const rect = el.querySelector('rect')
          if (!text) return
          text.setAttribute('font-family', 'system-ui, sans-serif')
          text.setAttribute('font-size', '13px')
          text.setAttribute('font-weight', '700')
          text.setAttribute('fill', isActive ? ACTIVE_COLOR : DEFAULT_COLOR)
          if (rect) {
            const bbox = text.getBBox()
            rect.setAttribute('x', String(bbox.x - 2))
            rect.setAttribute('y', String(bbox.y - 2))
            rect.setAttribute('width', String(bbox.width + 4))
            rect.setAttribute('height', String(bbox.height + 4))
            rect.setAttribute('fill', TAB_RECT_BG)
          }
        })
      }

      if (onRemove) {
        vexNotes.forEach((note, ni) => {
          const piece = measure.pieces[ni]
          if (piece.autoInserted) return
          const el = note.getSVGElement()
          if (!el) return
          el.style.cursor = 'pointer'
          el.addEventListener('click', () => onRemove(piece.sourceInstanceId))
        })
      }

      vexNotes.forEach((note, ni) => flatNotes.push({ el: note, piece: measure.pieces[ni] }))
    })

    if (mode === 'staff') {
      for (let i = 0; i < flatNotes.length - 1; i++) {
        if (flatNotes[i].piece.tiedToNext && flatNotes[i].piece.kind === 'note') {
          const tie = new StaveTie({ firstNote: flatNotes[i].el, lastNote: flatNotes[i + 1].el })
          tie.setStyle(DEFAULT_STYLE)
          tie.setContext(context).draw()
        }
      }
    }
  }, [items, onRemove, activeInstanceId, mode, theme])

  return <div ref={containerRef} className="overflow-x-auto" />
}
