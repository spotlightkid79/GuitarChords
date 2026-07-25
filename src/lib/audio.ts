import type { ChordShape } from '../data/chords'
import { midiAtFret } from './music-theory'

const STRUM_DELAY = 0.07
export const DEFAULT_CHORD_DURATION = 2.2
const NOTE_DURATION = 0.9
// Small lead-in so the first scheduled note is safely in the future by the time the
// audio thread processes it — scheduling exactly at currentTime gets silently dropped
// on some browsers (notably Safari).
const SCHEDULE_LEAD_IN = 0.08

type AudioContextConstructor = new () => AudioContext

function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioContext) {
    // Older Safari only exposes the constructor under the webkit-prefixed name.
    const Ctor: AudioContextConstructor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: AudioContextConstructor }).webkitAudioContext
    audioContext = new Ctor()
  }
  return audioContext
}

// Wrapped in a function so TS doesn't (incorrectly) narrow this live, browser-mutated getter across the await below.
function contextState(ctx: AudioContext): AudioContextState {
  return ctx.state
}

async function ensureRunning(ctx: AudioContext) {
  if (contextState(ctx) === 'running') return
  try {
    await ctx.resume()
  } catch (err) {
    console.warn('Could not start audio playback:', err)
    return
  }
  if (contextState(ctx) !== 'running') {
    console.warn(`Audio context is "${contextState(ctx)}" — the browser may be blocking sound on this page.`)
  }
}

function scheduleNote(ctx: AudioContext, freq: number, startTime: number, duration: number): OscillatorNode {
  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.value = freq

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(0.22, startTime + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(startTime)
  osc.stop(startTime + duration + 0.05)
  return osc
}

function scheduleChord(
  ctx: AudioContext,
  chord: ChordShape,
  startTime: number,
  noteDuration: number = DEFAULT_CHORD_DURATION,
): OscillatorNode[] {
  // Scale the strum spread with the note duration too, so a very short ring doesn't end up
  // strumming longer than the notes themselves last.
  const strumDelay = STRUM_DELAY * (noteDuration / DEFAULT_CHORD_DURATION)
  const oscillators: OscillatorNode[] = []
  let stringsPlayed = 0
  chord.frets.forEach((fret, stringIndex) => {
    if (typeof fret !== 'number') return
    const freq = midiToFrequency(midiAtFret(stringIndex, fret))
    oscillators.push(scheduleNote(ctx, freq, startTime + stringsPlayed * strumDelay, noteDuration))
    stringsPlayed += 1
  })
  return oscillators
}

/** Immediately silences an oscillator, whether it's already sounding or its start time is still in the future. */
function stopOscillator(osc: OscillatorNode) {
  try {
    osc.stop()
  } catch {
    // Already stopped/ended — nothing to do.
  }
}

/** Plays a single chord as a slow strum, low string to high string. */
export function playChord(chord: ChordShape) {
  const ctx = getAudioContext()
  void ensureRunning(ctx).then(() => {
    scheduleChord(ctx, chord, ctx.currentTime + SCHEDULE_LEAD_IN)
  })
}

export interface ChordSequenceHandle {
  /** Duration of a single pass through the sequence, in seconds — for a looping playback this is
   * one loop's length, not the (possibly infinite) total. */
  loopDuration: number
  /** Immediately silences everything scheduled by this call, including chords queued for later
   * in the sequence, and cancels any pending loop repeats. */
  stop: () => void
}

/**
 * Plays a list of chords back to back, optionally repeating.
 * `onChordStart`, if given, fires (via setTimeout, so it's approximate but good enough for UI
 * highlighting) right as each chord begins.
 * By default plays once through at DEFAULT_CHORD_DURATION per chord. Pass `{ repeatCount: N }` to
 * repeat N times, `{ loop: true }` to repeat indefinitely until `stop()` is called, `{ chordDuration }`
 * to speed up or slow down the transition between chords, and/or `{ sustain }` (a multiplier on
 * chordDuration, default 1) to stretch out or shorten how long each chord actually rings —
 * independent of the tempo, so a sustain above 1 lets a chord's sound bleed into the next one
 * (a legato/pad feel) without changing how fast the chords change.
 */
export function playChordSequence(
  chords: ChordShape[],
  onChordStart?: (chord: ChordShape, index: number) => void,
  options?: { loop?: boolean; repeatCount?: number; chordDuration?: number; sustain?: number },
): ChordSequenceHandle {
  const chordDuration = options?.chordDuration ?? DEFAULT_CHORD_DURATION
  const noteDuration = chordDuration * (options?.sustain ?? 1)
  const loopDuration = chords.length * chordDuration
  if (chords.length === 0) return { loopDuration, stop: () => {} }

  const ctx = getAudioContext()
  const repeatCount = options?.loop ? Infinity : Math.max(1, options?.repeatCount ?? 1)

  let stopped = false
  const activeOscillators: OscillatorNode[] = []
  const pendingTimeouts: number[] = []

  function schedulePass(passIndex: number) {
    if (stopped || passIndex >= repeatCount) return
    void ensureRunning(ctx).then(() => {
      if (stopped) return
      let time = ctx.currentTime + SCHEDULE_LEAD_IN
      chords.forEach((chord, i) => {
        activeOscillators.push(...scheduleChord(ctx, chord, time, noteDuration))
        if (onChordStart) {
          const id = window.setTimeout(
            () => {
              if (!stopped) onChordStart(chord, i)
            },
            (SCHEDULE_LEAD_IN + i * chordDuration) * 1000,
          )
          pendingTimeouts.push(id)
        }
        time += chordDuration
      })
      const nextPassId = window.setTimeout(() => schedulePass(passIndex + 1), loopDuration * 1000)
      pendingTimeouts.push(nextPassId)
    })
  }

  schedulePass(0)

  function stop() {
    stopped = true
    pendingTimeouts.forEach((id) => clearTimeout(id))
    pendingTimeouts.length = 0
    activeOscillators.forEach(stopOscillator)
    activeOscillators.length = 0
  }

  return { loopDuration, stop }
}

export interface FretPosition {
  stringIndex: number
  fret: number
}

/**
 * Plays every given fretboard position one at a time.
 * By default positions are sorted low to high (used for "ring every matching note" on the
 * fretboard); pass `sort: false` to play them in the given order instead (used for melody
 * playback, where the composed order matters).
 * `onNoteStart`, if given, fires (via setTimeout, so it's approximate but good enough for UI highlighting)
 * right as each note begins. Returns the total playback duration in seconds.
 */
export function playNotes(
  positions: FretPosition[],
  onNoteStart?: (position: FretPosition, index: number) => void,
  options?: { sort?: boolean },
): number {
  if (positions.length === 0) return 0
  const ctx = getAudioContext()
  const ordered =
    options?.sort === false
      ? positions
      : [...positions].sort((a, b) => midiAtFret(a.stringIndex, a.fret) - midiAtFret(b.stringIndex, b.fret))
  void ensureRunning(ctx).then(() => {
    let time = ctx.currentTime + SCHEDULE_LEAD_IN
    ordered.forEach((position, i) => {
      const freq = midiToFrequency(midiAtFret(position.stringIndex, position.fret))
      scheduleNote(ctx, freq, time, NOTE_DURATION)
      if (onNoteStart) {
        setTimeout(() => onNoteStart(position, i), (SCHEDULE_LEAD_IN + i * NOTE_DURATION) * 1000)
      }
      time += NOTE_DURATION
    })
  })
  return positions.length * NOTE_DURATION
}
