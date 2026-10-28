import { ArrowLeftRight, Check, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { Sheet } from '../../components/ui/Overlay'
import { errorMessage } from '../../lib/api'
import { useNow } from '../../hooks/useNow'
import { formatDay, hhmm } from '../../lib/dates'
import type { Shift } from '../shifts/api'
import { useAuth } from '../../auth/AuthContext'
import { can } from '../../auth/types'
import { isOpen, useCreateSwap, useMySwaps, useReviewSwap, useSwapAction, useSwapCandidates, useTeamSwaps, type ShiftSwap, type SwapShift, type SwapStatus } from './api'

const statusTone: Record<SwapStatus, 'neutral' | 'signal' | 'pause' | 'overrun'> = {
  PendingPeer: 'pause',
  PendingManager: 'pause',
  Approved: 'signal',
  Rejected: 'overrun',
  Declined: 'overrun',
  Cancelled: 'neutral',
  Expired: 'neutral',
}

/** Bir günün planını kısa yazar: "09:00–18:00 · Tam gün", "Hafta tatili", "Plan yok". */
export function ShiftText({ shift }: { shift: SwapShift | null }) {
  const { t } = useTranslation()
  if (!shift) return <>{t('swaps.noPlan')}</>
  if (shift.kind !== 'Work') return <>{t(`shifts.kinds.${shift.kind}`)}</>
  return (
    <span className="tabular">
      {hhmm(shift.startTime)}–{hhmm(shift.endTime)}
      {shift.templateName ? ` · ${shift.templateName}` : ''}
    </span>
  )
}

/** Takas özeti: kim neyi kime veriyor. */
function SwapSummary({ swap: s }: { swap: ShiftSwap }) {
  const { t } = useTranslation()
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">{s.requesterName}</p>
        <p className="text-ink-soft">
          <ShiftText shift={s.requesterShift} />
        </p>
      </div>
      <ArrowLeftRight className="size-4 text-ink-soft" aria-label={t('swaps.title')} />
      <div className="min-w-0 text-right">
        <p className="truncate font-medium">{s.targetName}</p>
        <p className="text-ink-soft">
          <ShiftText shift={s.targetShift} />
        </p>
      </div>
    </div>
  )
}

function SwapCard({ swap: s, children, me }: { swap: ShiftSwap; children?: ReactNode; me?: string }) {
  const { t } = useTranslation()
  return (
    <article className="rounded-2xl bg-panel p-4 ring-1 ring-line">
      <header className="mb-3 flex items-center justify-between gap-3">
        <p className="font-medium first-letter:uppercase">{formatDay(s.date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <Badge tone={statusTone[s.status]} dot>
          {t(`swaps.status.${s.status}`)}
        </Badge>
      </header>
      <SwapSummary swap={s} />
      {s.note && <p className="mt-3 text-sm text-ink-soft">“{s.note}”</p>}
      {s.reviewNote && (
        <p className="mt-2 rounded-xl bg-panel-2 px-3 py-2 text-sm ring-1 ring-line">
          {s.reviewedBy}: {s.reviewNote}
        </p>
      )}
      {me && s.targetUserId === me && s.status === 'PendingPeer' && <p className="mt-3 text-sm">{t('swaps.incomingHint', { name: s.requesterName })}</p>}
      {children && <div className="mt-3 flex flex-wrap justify-end gap-2">{children}</div>}
    </article>
  )
}

/** Vardiyalarım sayfasının üstünde: bana gelen ve benim istediğim takaslar. */
export function MySwaps({ me }: { me: string }) {
  const { t } = useTranslation()
  const swaps = useMySwaps()
  const action = useSwapAction()
  const now = useNow(60_000).getTime()
  const recent = (swaps.data ?? []).filter((s) => isOpen(s) || now - new Date(s.createdAt).getTime() < 7 * 86_400_000)
  if (recent.length === 0) return null

  const run = async (id: string, a: 'accept' | 'decline' | 'cancel', ok: string) => {
    try {
      await action.mutateAsync({ id, action: a })
      toast.success(ok)
    } catch (err) {
      toast.error(errorMessage(err, t))
    }
  }

  return (
    <section className="mb-6">
      <h2 className="mb-3 font-semibold">{t('swaps.mine')}</h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {recent.map((s) => (
          <SwapCard key={s.id} swap={s} me={me}>
            {s.status === 'PendingPeer' && s.targetUserId === me && (
              <>
                <Button variant="secondary" size="sm" onClick={() => run(s.id, 'decline', t('swaps.declined'))}>
                  <X className="size-4" />
                  {t('swaps.decline')}
                </Button>
                <Button size="sm" onClick={() => run(s.id, 'accept', t('swaps.accepted'))}>
                  <Check className="size-4" />
                  {t('swaps.accept')}
                </Button>
              </>
            )}
            {isOpen(s) && s.requesterId === me && (
              <Button variant="ghost" size="sm" onClick={() => run(s.id, 'cancel', t('swaps.cancelled'))}>
                {t('swaps.cancel')}
              </Button>
            )}
          </SwapCard>
        ))}
      </div>
    </section>
  )
}

/** Bir vardiya için takas isteği: ekip arkadaşı seç, not yaz, gönder. */
export function SwapSheet({ shift, onClose }: { shift: Shift | null; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <Sheet
      open={!!shift}
      onClose={onClose}
      closeLabel={t('common.close')}
      title={t('swaps.requestTitle')}
      description={shift ? `${formatDay(shift.date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${hhmm(shift.startTime)}–${hhmm(shift.endTime)}` : ''}
    >
      {shift && <SwapForm key={shift.id} shift={shift} onDone={onClose} />}
    </Sheet>
  )
}

function SwapForm({ shift, onDone }: { shift: Shift; onDone: () => void }) {
  const { t } = useTranslation()
  const candidates = useSwapCandidates(shift.id)
  const create = useCreateSwap()
  const [target, setTarget] = useState<string | null>(null)
  const [note, setNote] = useState('')

  async function send() {
    if (!target) return
    try {
      await create.mutateAsync({ shiftId: shift.id, targetUserId: target, note: note.trim() || null })
      toast.success(t('swaps.sent'))
      onDone()
    } catch (err) {
      toast.error(errorMessage(err, t))
    }
  }

  if (candidates.isError) return <p className="text-sm text-overrun">{errorMessage(candidates.error, t)}</p>

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-soft">{t('swaps.howItWorks')}</p>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t('swaps.pickColleague')}</legend>
        <ul className="space-y-2">
          {(candidates.data ?? []).map((c) => (
            <li key={c.userId}>
              <label
                className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${!c.available ? 'cursor-not-allowed opacity-55' : target === c.userId ? 'cursor-pointer border-signal bg-signal-soft/60' : 'cursor-pointer border-line hover:bg-panel-2'}`}
              >
                <input type="radio" name="target" className="sr-only" disabled={!c.available} checked={target === c.userId} onChange={() => setTarget(c.userId)} />
                <Avatar name={c.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{c.name}</span>
                  <span className="block text-sm text-ink-soft">
                    {t('swaps.theirDay')}: <ShiftText shift={c.shift} />
                  </span>
                </span>
                {!c.available && c.reason && <span className="text-xs text-ink-soft">{t(`swaps.reasons.${c.reason}`)}</span>}
              </label>
            </li>
          ))}
          {candidates.data?.length === 0 && <li className="text-sm text-ink-soft">{t('swaps.noColleagues')}</li>}
        </ul>
      </fieldset>
      <Input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder={t('swaps.notePlaceholder')} aria-label={t('swaps.note')} />
      <Button className="w-full" onClick={send} disabled={!target} loading={create.isPending}>
        <ArrowLeftRight className="size-4" />
        {t('swaps.send')}
      </Button>
    </div>
  )
}

/** Müdürün onay listesi (Talepler sayfasında). */
export function TeamSwaps({ pendingOnly }: { pendingOnly: boolean }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const swaps = useTeamSwaps(pendingOnly, can(user, 'shifts.plan'))
  const review = useReviewSwap()
  const [notes, setNotes] = useState<Record<string, string>>({})
  if (!swaps.data || swaps.data.length === 0) return null

  const decide = async (id: string, approve: boolean) => {
    try {
      await review.mutateAsync({ id, approve, note: notes[id]?.trim() || null })
      toast.success(approve ? t('swaps.approved') : t('swaps.rejected'))
    } catch (err) {
      toast.error(errorMessage(err, t))
    }
  }

  return (
    <section className="mb-6">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <ArrowLeftRight className="size-4" />
        {t('swaps.teamTitle')}
      </h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {swaps.data.map((s) => (
          <SwapCard key={s.id} swap={s}>
            {s.status === 'PendingManager' && (
              <>
                <Input
                  value={notes[s.id] ?? ''}
                  onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                  placeholder={t('requests.notePlaceholder')}
                  className="min-w-40 flex-1 py-1.5"
                />
                <Button variant="secondary" size="sm" onClick={() => decide(s.id, false)}>
                  <X className="size-4" />
                  {t('requests.reject')}
                </Button>
                <Button size="sm" onClick={() => decide(s.id, true)}>
                  <Check className="size-4" />
                  {t('requests.approve')}
                </Button>
              </>
            )}
          </SwapCard>
        ))}
      </div>
    </section>
  )
}
