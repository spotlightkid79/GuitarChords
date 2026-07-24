import type { ChordShape } from '../data/chords'
import type { ScaleType } from '../data/scales'
import { STANDARD_TUNING, noteAtFret, type NoteName } from '../lib/music-theory'

interface ChordFretboardProps {
  mode: 'chord'
  chord: ChordShape
}

interface ScaleFretboardProps {
  mode: 'scale'
  rootNote: NoteName
  scaleType: ScaleType
  fretCount?: number
}

interface NotesFretboardProps {
  mode: 'notes'
  highlightNote?: NoteName | null
  fretCount?: number
}

type FretboardProps = ChordFretboardProps | ScaleFretboardProps | NotesFretboardProps

const STRING_COUNT = 6
const ROWS = 4

function ChordDiagram({ chord }: { chord: ChordShape }) {
  const width = 132
  const height = 150
  const padTop = 26
  const padBottom = 10
  const padSide = 14
  const padRight = 26
  const gridW = width - padSide - padRight
  const gridH = height - padTop - padBottom
  const stringGap = gridW / (STRING_COUNT - 1)
  const rowGap = gridH / ROWS

  const rowOf = (fret: number) => fret - chord.baseFret + 1

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" role="img" aria-label={chord.label}>
      {/* open/mute markers */}
      {chord.frets.map((f, i) => {
        const x = padSide + i * stringGap
        if (f === 'x') {
          return (
            <text key={i} x={x} y={padTop - 12} textAnchor="middle" fontSize="10" fill="#9ca3af">
              x
            </text>
          )
        }
        if (f === 0) {
          return (
            <circle key={i} cx={x} cy={padTop - 14} r="3.5" fill="none" stroke="#9ca3af" strokeWidth="1.5" />
          )
        }
        return null
      })}

      {/* nut or top line */}
      <line
        x1={padSide}
        y1={padTop}
        x2={padSide + gridW}
        y2={padTop}
        stroke="#c084fc"
        strokeWidth={chord.baseFret === 1 ? 3 : 1}
      />

      {/* fret lines */}
      {Array.from({ length: ROWS }).map((_, r) => (
        <line
          key={r}
          x1={padSide}
          y1={padTop + rowGap * (r + 1)}
          x2={padSide + gridW}
          y2={padTop + rowGap * (r + 1)}
          stroke="#3f3f4a"
          strokeWidth="1"
        />
      ))}

      {/* string lines */}
      {Array.from({ length: STRING_COUNT }).map((_, s) => (
        <line
          key={s}
          x1={padSide + s * stringGap}
          y1={padTop}
          x2={padSide + s * stringGap}
          y2={padTop + gridH}
          stroke="#5a5a66"
          strokeWidth="1"
        />
      ))}

      {/* barre */}
      {chord.barre && (
        <line
          x1={padSide + chord.barre.fromString * stringGap}
          y1={padTop + rowGap * (rowOf(chord.barre.fret) - 0.5)}
          x2={padSide + chord.barre.toString * stringGap}
          y2={padTop + rowGap * (rowOf(chord.barre.fret) - 0.5)}
          stroke="#c084fc"
          strokeWidth="8"
          strokeLinecap="round"
          opacity="0.85"
        />
      )}

      {/* finger dots */}
      {chord.frets.map((f, i) => {
        if (typeof f !== 'number' || f === 0) return null
        const x = padSide + i * stringGap
        const y = padTop + rowGap * (rowOf(f) - 0.5)
        return <circle key={i} cx={x} cy={y} r="6.5" fill="#c084fc" />
      })}

      {/* base fret label */}
      {chord.baseFret > 1 && (
        <text
          x={width - 4}
          y={padTop + rowGap * 0.75}
          textAnchor="end"
          fontSize="10"
          fontWeight="700"
          fill="#f5f0ff"
          stroke="#0f1115"
          strokeWidth="3"
          paintOrder="stroke"
        >
          {chord.baseFret}fr
        </text>
      )}
    </svg>
  )
}

function NeckDiagram({
  fretCount = 12,
  isVisible,
  isEmphasis,
  ariaLabel,
}: {
  fretCount?: number
  isVisible: (note: NoteName) => boolean
  isEmphasis: (note: NoteName) => boolean
  ariaLabel: string
}) {
  const width = Math.max(640, fretCount * 52)
  const height = 190
  const padLeft = 28
  const padRight = 16
  const padTop = 14
  const padBottom = 26
  const gridW = width - padLeft - padRight
  const gridH = height - padTop - padBottom
  const fretGap = gridW / fretCount
  const stringGap = gridH / (STRING_COUNT - 1)
  const markerFrets = new Set([3, 5, 7, 9, 12])

  // row 0 = high e (string index 5), row 5 = low E (string index 0)
  const rowToStringIndex = (row: number) => STRING_COUNT - 1 - row

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={ariaLabel}>
      {/* fretboard background */}
      <rect x={padLeft} y={padTop} width={gridW} height={gridH} fill="#1a1b22" rx="4" />

      {/* fret markers */}
      {Array.from({ length: fretCount + 1 }).map((_, fret) => {
        if (!markerFrets.has(fret)) return null
        const x = padLeft + fretGap * (fret - 0.5)
        return (
          <text key={fret} x={x} y={height - 6} textAnchor="middle" fontSize="10" fill="#6b6b78">
            {fret}
          </text>
        )
      })}

      {/* fret lines */}
      {Array.from({ length: fretCount + 1 }).map((_, fret) => (
        <line
          key={fret}
          x1={padLeft + fretGap * fret}
          y1={padTop}
          x2={padLeft + fretGap * fret}
          y2={padTop + gridH}
          stroke={fret === 0 ? '#c084fc' : '#3f3f4a'}
          strokeWidth={fret === 0 ? 3 : 1}
        />
      ))}

      {/* string lines */}
      {Array.from({ length: STRING_COUNT }).map((_, row) => (
        <line
          key={row}
          x1={padLeft}
          y1={padTop + row * stringGap}
          x2={padLeft + gridW}
          y2={padTop + row * stringGap}
          stroke="#5a5a66"
          strokeWidth="1"
        />
      ))}

      {/* string open-note labels */}
      {Array.from({ length: STRING_COUNT }).map((_, row) => (
        <text key={row} x={padLeft - 10} y={padTop + row * stringGap + 3} textAnchor="end" fontSize="10" fill="#6b6b78">
          {STANDARD_TUNING[rowToStringIndex(row)]}
        </text>
      ))}

      {/* note dots */}
      {Array.from({ length: STRING_COUNT }).flatMap((_, row) =>
        Array.from({ length: fretCount + 1 }).map((_, fret) => {
          const stringIdx = rowToStringIndex(row)
          const note = noteAtFret(STANDARD_TUNING[stringIdx], fret)
          if (!isVisible(note)) return null
          const emphasis = isEmphasis(note)
          const x = fret === 0 ? padLeft + 8 : padLeft + fretGap * (fret - 0.5)
          const y = padTop + row * stringGap
          return (
            <g key={`${row}-${fret}`}>
              <circle cx={x} cy={y} r="9.5" fill={emphasis ? '#c084fc' : '#2e303a'} stroke={emphasis ? '#c084fc' : '#6b6b78'} strokeWidth="1.5" />
              <text x={x} y={y + 3.5} textAnchor="middle" fontSize="9" fontWeight={emphasis ? 700 : 400} fill={emphasis ? '#0f1115' : '#e8e8ec'}>
                {note}
              </text>
            </g>
          )
        }),
      )}
    </svg>
  )
}

function ScaleNeck({ rootNote, scaleType, fretCount = 12 }: Omit<ScaleFretboardProps, 'mode'>) {
  const scaleNotes = new Set(scaleType.intervals.map((i) => noteAtFret(rootNote, i)))
  return (
    <NeckDiagram
      fretCount={fretCount}
      isVisible={(note) => scaleNotes.has(note)}
      isEmphasis={(note) => note === rootNote}
      ariaLabel={`${rootNote} ${scaleType.name}`}
    />
  )
}

function NotesNeck({ highlightNote = null, fretCount = 12 }: Omit<NotesFretboardProps, 'mode'>) {
  return (
    <NeckDiagram
      fretCount={fretCount}
      isVisible={() => true}
      isEmphasis={(note) => highlightNote !== null && note === highlightNote}
      ariaLabel={highlightNote ? `Fretboard notes, highlighting ${highlightNote}` : 'Fretboard notes'}
    />
  )
}

export default function Fretboard(props: FretboardProps) {
  if (props.mode === 'chord') return <ChordDiagram chord={props.chord} />
  if (props.mode === 'scale') return <ScaleNeck {...props} />
  return <NotesNeck {...props} />
}
