import type { ChordShape } from '../data/chords'
import { STANDARD_TUNING, noteIndex } from './music-theory'

// Standard tuning octaves, low E .. high E (E2 A2 D3 G3 B3 E4).
const STRING_OCTAVE = [2, 2, 3, 3, 3, 4]

const STRUM_DELAY = 0.07
const CHORD_DURATION = 2.2

function midiForOpenString(stringIndex: number): number {
  return (STRING_OCTAVE[stringIndex] + 1) * 12 + noteIndex(STANDARD_TUNING[stringIndex])
}

function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioContext) audioContext = new AudioContext()
  if (audioContext.state === 'suspended') void audioContext.resume()
  return audioContext
}

function scheduleChord(ctx: AudioContext, chord: ChordShape, startTime: number) {
  let stringsPlayed = 0
  chord.frets.forEach((fret, stringIndex) => {
    if (typeof fret !== 'number') return
    const freq = midiToFrequency(midiForOpenString(stringIndex) + fret)
    const noteStart = startTime + stringsPlayed * STRUM_DELAY
    stringsPlayed += 1

    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = freq

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, noteStart)
    gain.gain.linearRampToValueAtTime(0.22, noteStart + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + CHORD_DURATION)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(noteStart)
    osc.stop(noteStart + CHORD_DURATION + 0.05)
  })
}

/** Plays a single chord as a slow strum, low string to high string. */
export function playChord(chord: ChordShape) {
  const ctx = getAudioContext()
  scheduleChord(ctx, chord, ctx.currentTime)
}

/** Plays a list of chords back to back. Returns the total playback duration in seconds. */
export function playChordSequence(chords: ChordShape[]): number {
  if (chords.length === 0) return 0
  const ctx = getAudioContext()
  let time = ctx.currentTime
  chords.forEach((chord) => {
    scheduleChord(ctx, chord, time)
    time += CHORD_DURATION
  })
  return chords.length * CHORD_DURATION
}
