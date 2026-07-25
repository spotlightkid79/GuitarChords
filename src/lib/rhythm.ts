import type { NoteName } from './music-theory'

export type DurationCode = 'w' | 'h' | 'q' | '8' | '16'

export const DURATIONS: { code: DurationCode; label: string; symbol: string }[] = [
  { code: 'w', label: 'Whole', symbol: '𝅝' },
  { code: 'h', label: 'Half', symbol: '𝅗𝅥' },
  { code: 'q', label: 'Quarter', symbol: '♩' },
  { code: '8', label: 'Eighth', symbol: '♪' },
  { code: '16', label: 'Sixteenth', symbol: '𝅘𝅥𝅯' },
]

export interface TimeSig {
  beats: number
  beatValue: number
}

export const COMMON_TIME_SIGNATURES: { label: string; sig: TimeSig }[] = [
  { label: '4/4', sig: { beats: 4, beatValue: 4 } },
  { label: '3/4', sig: { beats: 3, beatValue: 4 } },
  { label: '2/4', sig: { beats: 2, beatValue: 4 } },
  { label: '6/8', sig: { beats: 6, beatValue: 8 } },
  { label: '9/8', sig: { beats: 9, beatValue: 8 } },
  { label: '12/8', sig: { beats: 12, beatValue: 8 } },
  { label: '2/2', sig: { beats: 2, beatValue: 2 } },
]

export const DEFAULT_TIME_SIG: TimeSig = { beats: 4, beatValue: 4 }

export function sigLabel(sig: TimeSig): string {
  return `${sig.beats}/${sig.beatValue}`
}

// --- Event model -----------------------------------------------------------
// A melody line is a flat, ordered stream of events. Measures are never
// stored — they're a derived layout computed fresh by layoutMeasures() below,
// so reordering/removing notes or changing a time signature can never leave
// stale measure boundaries lying around.

interface BaseEvent {
  instanceId: string
  duration: DurationCode
  dotted: boolean
}

export interface NoteEvent extends BaseEvent {
  type: 'note'
  note: NoteName
  stringIndex: number
  fret: number
}

export interface RestEvent extends BaseEvent {
  type: 'rest'
}

export interface TimeSignatureEvent {
  instanceId: string
  type: 'time-signature'
  beats: number
  beatValue: number
}

export type MelodyEvent = NoteEvent | RestEvent | TimeSignatureEvent

export function isNoteEvent(ev: MelodyEvent): ev is NoteEvent {
  return ev.type === 'note'
}

// --- Duration <-> tick math --------------------------------------------------
// Ticks are integers (a sixteenth note = 1 tick, a quarter note = 4 ticks) so
// all the fitting/splitting logic below is exact integer arithmetic with no
// floating-point rounding to worry about.

const DURATION_TICKS: Record<DurationCode, number> = { w: 16, h: 8, q: 4, '8': 2, '16': 1 }

export function eventTicks(duration: DurationCode, dotted: boolean): number {
  const base = DURATION_TICKS[duration]
  return dotted ? base * 1.5 : base
}

function measureCapacityTicks(sig: TimeSig): number {
  return sig.beats * (16 / sig.beatValue)
}

const CANONICAL: { duration: DurationCode; dotted: boolean; ticks: number }[] = [
  { duration: 'w', dotted: false, ticks: 16 },
  { duration: 'h', dotted: true, ticks: 12 },
  { duration: 'h', dotted: false, ticks: 8 },
  { duration: 'q', dotted: true, ticks: 6 },
  { duration: 'q', dotted: false, ticks: 4 },
  { duration: '8', dotted: true, ticks: 3 },
  { duration: '8', dotted: false, ticks: 2 },
  { duration: '16', dotted: false, ticks: 1 },
]

/** Breaks an arbitrary positive tick count into the fewest canonical note/rest durations (greedy, largest first). */
export function decomposeTicks(ticks: number): { duration: DurationCode; dotted: boolean }[] {
  const pieces: { duration: DurationCode; dotted: boolean }[] = []
  let remaining = Math.round(ticks)
  for (const c of CANONICAL) {
    while (remaining >= c.ticks) {
      pieces.push({ duration: c.duration, dotted: c.dotted })
      remaining -= c.ticks
    }
  }
  return pieces
}

// --- Layout ------------------------------------------------------------------

export interface LayoutPiece {
  sourceInstanceId: string
  kind: 'note' | 'rest'
  duration: DurationCode
  dotted: boolean
  tiedToNext: boolean
  autoInserted: boolean
  note?: NoteName
  stringIndex?: number
  fret?: number
}

export interface Measure {
  id: string
  sig: TimeSig
  showTimeSignature: boolean
  pieces: LayoutPiece[]
}

/**
 * Turns a flat event stream into notation-ready measures: fits notes/rests into
 * bars under the current time signature, splitting (and tying) any note that
 * would overflow a bar, and padding under-filled bars with auto-inserted rests.
 * Encountering a `time-signature` event always starts a fresh measure — the new
 * signature applies from that point forward ("dynamic re-barring").
 */
export function layoutMeasures(events: MelodyEvent[]): Measure[] {
  const measures: Measure[] = []
  let sig: TimeSig = DEFAULT_TIME_SIG
  let showNextTimeSignature = true
  let current: Measure | null = null
  let currentTicks = 0
  let autoCounter = 0

  function capacity(): number {
    return measureCapacityTicks(sig)
  }

  function openMeasure() {
    current = { id: `measure-${measures.length}`, sig, showTimeSignature: showNextTimeSignature, pieces: [] }
    measures.push(current)
    currentTicks = 0
    showNextTimeSignature = false
  }

  function padCurrentToCapacity() {
    if (!current) return
    const remaining = measureCapacityTicks(current.sig) - currentTicks
    if (remaining <= 0) return
    for (const frag of decomposeTicks(remaining)) {
      current.pieces.push({
        sourceInstanceId: `auto-${current.id}-${autoCounter++}`,
        kind: 'rest',
        duration: frag.duration,
        dotted: frag.dotted,
        tiedToNext: false,
        autoInserted: true,
      })
    }
  }

  function placePiece(base: Omit<LayoutPiece, 'tiedToNext' | 'autoInserted'>, ticks: number) {
    if (!current) openMeasure()
    const cap = capacity()
    const remaining = cap - currentTicks
    if (ticks <= remaining) {
      current!.pieces.push({ ...base, tiedToNext: false, autoInserted: false })
      currentTicks += ticks
      if (currentTicks >= cap) current = null
      return
    }

    // Overflow: fill the rest of this measure, tie the remainder into the next one(s).
    if (remaining > 0) {
      const fillFragments = decomposeTicks(remaining)
      fillFragments.forEach((frag) => {
        current!.pieces.push({
          ...base,
          duration: frag.duration,
          dotted: frag.dotted,
          tiedToNext: base.kind === 'note',
          autoInserted: false,
        })
      })
    }
    current = null

    const leftoverTicks = ticks - Math.max(remaining, 0)
    const leftoverFragments = decomposeTicks(leftoverTicks)
    leftoverFragments.forEach((frag, i) => {
      const isLast = i === leftoverFragments.length - 1
      const fragTicks = eventTicks(frag.duration, frag.dotted)
      if (isLast) {
        placePiece({ ...base, duration: frag.duration, dotted: frag.dotted }, fragTicks)
      } else {
        if (!current) openMeasure()
        current!.pieces.push({
          ...base,
          duration: frag.duration,
          dotted: frag.dotted,
          tiedToNext: base.kind === 'note',
          autoInserted: false,
        })
        currentTicks += fragTicks
      }
    })
  }

  for (const ev of events) {
    if (ev.type === 'time-signature') {
      padCurrentToCapacity()
      sig = { beats: ev.beats, beatValue: ev.beatValue }
      current = null
      showNextTimeSignature = true
      continue
    }

    const ticks = eventTicks(ev.duration, ev.dotted)
    if (ev.type === 'note') {
      placePiece(
        {
          sourceInstanceId: ev.instanceId,
          kind: 'note',
          duration: ev.duration,
          dotted: ev.dotted,
          note: ev.note,
          stringIndex: ev.stringIndex,
          fret: ev.fret,
        },
        ticks,
      )
    } else {
      placePiece({ sourceInstanceId: ev.instanceId, kind: 'rest', duration: ev.duration, dotted: ev.dotted }, ticks)
    }
  }

  padCurrentToCapacity()

  if (measures.length === 0) {
    measures.push({ id: 'measure-0', sig, showTimeSignature: true, pieces: [] })
  }

  return measures
}
