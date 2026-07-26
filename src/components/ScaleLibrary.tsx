import { useState } from 'react'
import { SCALE_TYPES } from '../data/scales'
import { ALL_ROOTS, type NoteName } from '../lib/music-theory'
import Fretboard from './Fretboard'

export default function ScaleLibrary() {
  const [root, setRoot] = useState<NoteName>('C')
  const [scaleId, setScaleId] = useState(SCALE_TYPES[0].id)

  const scaleType = SCALE_TYPES.find((s) => s.id === scaleId) ?? SCALE_TYPES[0]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={root}
          onChange={(e) => setRoot(e.target.value as NoteName)}
          className="rounded-md border border-black/10 bg-black/[0.03] px-2 py-1.5 text-sm text-zinc-900 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
        >
          {ALL_ROOTS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={scaleId}
          onChange={(e) => setScaleId(e.target.value)}
          className="rounded-md border border-black/10 bg-black/[0.03] px-2 py-1.5 text-sm text-zinc-900 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
        >
          {SCALE_TYPES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {root} {scaleType.name}
        </h2>
        <div className="w-full overflow-x-auto rounded-lg border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/5">
          <Fretboard mode="scale" rootNote={root} scaleType={scaleType} />
        </div>
      </div>
    </div>
  )
}
