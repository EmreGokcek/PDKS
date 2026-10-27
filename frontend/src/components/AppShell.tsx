import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { roleLabels } from '../auth/types'

/** Giriş yapılmış sayfaların ortak üst çubuğu. */
export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const { user, logout } = useAuth()
  if (!user) return null

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="" className="size-8" />
            <div className="leading-tight">
              <p className="font-semibold">{user.companyName}</p>
              {user.branchName && <p className="text-sm text-ink-soft">{user.branchName}</p>}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden text-right leading-tight sm:block">
              <p className="font-medium">{user.fullName}</p>
              <p className="text-sm text-ink-soft">{roleLabels[user.role]}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-paper"
            >
              Çıkış yap
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-6">{children}</div>
      </main>
    </div>
  )
}

/** Henüz yapılmamış bölümler için yer tutucu. */
export function ComingSoon({ items }: { items: string[] }) {
  return (
    <section className="rounded-xl border border-dashed border-line bg-panel p-6">
      <p className="text-ink-soft">Bu panel sonraki adımlarda dolacak. Planlananlar:</p>
      <ul className="mt-3 list-disc space-y-1 pl-5">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}
