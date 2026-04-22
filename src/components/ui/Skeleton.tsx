interface SkeletonProps {
  className?: string
  lines?: number
}

export function Skeleton({ className = '', lines }: SkeletonProps) {
  if (lines !== undefined && lines > 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded h-4 bg-slate-700/60"
          />
        ))}
      </div>
    )
  }

  return (
    <div className={`animate-pulse rounded-xl bg-slate-700/60 ${className}`} />
  )
}
