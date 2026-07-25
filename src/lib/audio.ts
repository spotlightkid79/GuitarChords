import type { ChordShape } from '../data/chords'
import { STANDARD_TUNING, noteIndex } from './music-theory'

// Standard tuning octaves, low E .. high E (E2 A2 D3 G3 B3 E4).
const STRING_OCTAVE = [2, 2, 3, 3, 3, 4]

const STRUM_DELAY = 0.07
const CHORD_DURATION = 2.2
const NOTE_DURATION = 0.9
// Small lead-in so the first scheduled note is safely in the future by the time the
// audio thread processes it — scheduling exactly at currentTime gets silently dropped
// on some browsers (notably Safari).
const SCHEDULE_LEAD_IN = 0.08

type AudioContextConstructor = new () => AudioContext

function midiForOpenString(stringIndex: number): number {
  return (STRING_OCTAVE[stringIndex] + 1) * 12 + noteIndex(STANDARD_TUNING[stringIndex])
}

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

function scheduleNote(ctx: AudioContext, freq: number, startTime: number, duration: number) {
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
}

function scheduleChord(ctx: AudioContext, chord: ChordShape, startTime: number) {
  let stringsPlayed = 0
  chord.frets.forEach((fret, stringIndex) => {
    if (typeof fret !== 'number') return
    const freq = midiToFrequency(midiForOpenString(stringIndex) + fret)
    scheduleNote(ctx, freq, startTime + stringsPlayed * STRUM_DELAY, CHORD_DURATION)
    stringsPlayed += 1
  })
}

/** Plays a single chord as a slow strum, low string to high string. */
export function playChord(chord: ChordShape) {
  const ctx = getAudioContext()
  void ensureRunning(ctx).then(() => {
    scheduleChord(ctx, chord, ctx.currentTime + SCHEDULE_LEAD_IN)
  })
}

/** Plays a list of chords back to back. Returns the total playback duration in seconds. */
export function playChordSequence(chords: ChordShape[]): number {
  if (chords.length === 0) return 0
  const ctx = getAudioContext()
  void ensureRunning(ctx).then(() => {
    let time = ctx.currentTime + SCHEDULE_LEAD_IN
    chords.forEach((chord) => {
      scheduleChord(ctx, chord, time)
      time += CHORD_DURATION
    })
  })
  return chords.length * CHORD_DURATION
}

export interface FretPosition {
  stringIndex: number
  fret: number
}

/**
 * Plays every given fretboard position one at a time, low to high.
 * `onNoteStart`, if given, fires (via setTimeout, so it's approximate but good enough for UI highlighting)
 * right as each note begins. Returns the total playback duration in seconds.
 */
export function playNotes(positions: FretPosition[], onNoteStart?: (position: FretPosition, index: number) => void): number {
  if (positions.length === 0) return 0
  const ctx = getAudioContext()
  const sorted = [...positions].sort(
    (a, b) => midiForOpenString(a.stringIndex) + a.fret - (midiForOpenString(b.stringIndex) + b.fret),
  )
  void ensureRunning(ctx).then(() => {
    let time = ctx.currentTime + SCHEDULE_LEAD_IN
    sorted.forEach((position, i) => {
      const freq = midiToFrequency(midiForOpenString(position.stringIndex) + position.fret)
      scheduleNote(ctx, freq, time, NOTE_DURATION)
      if (onNoteStart) {
        setTimeout(() => onNoteStart(position, i), (SCHEDULE_LEAD_IN + i * NOTE_DURATION) * 1000)
      }
      time += NOTE_DURATION
    })
  })
  return positions.length * NOTE_DURATION
}
