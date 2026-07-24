import { useMemo, useState } from 'react'
import { CHORDS, CHORD_QUALITIES, QUALITY_LABEL, QUALITY_NAME, type ChordQuality } from '../data/chords'
import { ALL_ROOTS } from '../lib/music-theory'
import { LibraryChordCard } from './ChordCard'

export default function ChordLibrary() {
  const [root, setRoot] = useState<string>('all')
  const [quality, setQuality] = useState<ChordQuality | 'all'>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return CHORDS.filter((c) => {
      if (root !== 'all' && c.root !== root) return false
      if (quality !== 'all' && c.quality !== quality) return false
      if (q && !c.label.toLowerCase().includes(q)) return false
      return true
    })
  }, [root, quality, search])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chords (e.g. C, Am7)"
          className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-400"
        />
        <select
          value={root}
          onChange={(e) => setRoot(e.target.value)}
          className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-zinc-100"
        >
          <option value="all">All roots</option>
          {ALL_ROOTS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={quality}
          onChange={(e) => setQuality(e.target.value as ChordQuality | 'all')}
          className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-zinc-100"
        >
          <option value="all">All qualities</option>
          {CHORD_QUALITIES.map((q) => (
            <option key={q} value={q}>
              {QUALITY_NAME[q]} ({QUALITY_LABEL[q] || 'maj'})
            </option>
          ))}
        </select>
        <span className="text-xs text-zinc-500">{filtered.length} chords</span>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-3">
        {filtered.map((chord) => (
          <LibraryChordCard key={chord.id} chord={chord} />
        ))}
      </div>
    </div>
  )
}
