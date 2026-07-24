import type { ChordShape } from '../data/chords'
import { STANDARD_TUNING, noteIndex } from './music-theory'

// Standard tuning octaves, low E .. high E (E2 A2 D3 G3 B3 E4).
const STRING_OCTAVE = [2, 2, 3, 3, 3, 4]

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

/** Plays a chord as a gentle strum, low string to high string. */
export function playChord(chord: ChordShape) {
  const ctx = getAudioContext()
  const now = ctx.currentTime
  const strumDelay = 0.035
  const duration = 1.3

  let stringsPlayed = 0
  chord.frets.forEach((fret, stringIndex) => {
    if (typeof fret !== 'number') return
    const freq = midiToFrequency(midiForOpenString(stringIndex) + fret)
    const startTime = now + stringsPlayed * strumDelay
    stringsPlayed += 1

    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = freq

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, startTime)
    gain.gain.linearRampToValueAtTime(0.22, startTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(startTime)
    osc.stop(startTime + duration + 0.05)
  })
}
