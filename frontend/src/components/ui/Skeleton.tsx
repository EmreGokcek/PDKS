/** İçerik yüklenirken yerini tutan, hafifçe parlayan gri blok. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-lg bg-ink/[0.07] dark:bg-ink/[0.09] ${className}`} />
}

type Variant = 'hero' | 'cards' | 'table' | 'list' | 'grid'

/** Sayfa yüklenirken içeriğin kaba iskeleti. Düzen, gelecek içeriğe benzer. */
export function PageSkeleton({ variant = 'cards', label }: { variant?: Variant; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">{label ?? '…'}</span>
      {variant === 'hero' && (
        <>
          <Skeleton className="h-56 rounded-3xl" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className={`h-32 rounded-2xl ${i === 2 ? 'col-span-2 sm:col-span-1' : ''}`} />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Skeleton className="h-56 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
          </div>
        </>
      )}
      {variant === 'cards' && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-36 rounded-2xl" />
            ))}
          </div>
        </>
      )}
      {variant === 'grid' && (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-52 rounded-2xl" />
          ))}
        </div>
      )}
      {variant === 'list' && (
        <div className="grid gap-3 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      )}
      {variant === 'table' && (
        <div className="overflow-hidden rounded-2xl ring-1 ring-line">
          <Skeleton className="h-12 rounded-none" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 border-t border-line px-5 py-4">
              <Skeleton className="size-9 shrink-0 rounded-sm" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="hidden h-3.5 w-1/3 sm:block" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
