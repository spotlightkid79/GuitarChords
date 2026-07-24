export default function ExpandToggle({
  expanded,
  onClick,
  className = '',
}: {
  expanded: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={expanded ? 'Collapse' : 'Expand'}
      aria-expanded={expanded}
      title={expanded ? 'Collapse' : 'Expand'}
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-zinc-500 text-zinc-400 hover:border-zinc-300 hover:text-zinc-200 ${className}`}
    >
      {expanded ? <span className="h-px w-2 bg-current" /> : <span className="h-2 w-2 border border-current" />}
    </button>
  )
}
