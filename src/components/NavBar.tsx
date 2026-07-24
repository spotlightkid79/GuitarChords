export type Tab = 'chords' | 'scales' | 'notes' | 'songs'

const TABS: { id: Tab; label: string }[] = [
  { id: 'chords', label: 'Chords' },
  { id: 'scales', label: 'Scales' },
  { id: 'notes', label: 'Notes' },
  { id: 'songs', label: 'Songs' },
]

export default function NavBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <header className="flex items-center gap-6 border-b border-white/10 px-4 py-3">
      <span className="text-base font-bold tracking-tight text-zinc-100">Guitar Reference</span>
      <nav className="flex gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active === tab.id
                ? 'bg-purple-500/20 text-purple-300'
                : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  )
}
