import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthContext'
import { can } from '../../auth/types'
import { PageHeader } from '../../components/AppShell'
import { Badge } from '../../components/ui/Badge'
import { Button, IconButton } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { Dialog } from '../../components/ui/Overlay'
import { Segmented } from '../../components/ui/Segmented'
import { PageSkeleton } from '../../components/ui/Skeleton'
import { errorMessage } from '../../lib/api'
import { addDays, formatDay, isoDate, parseDate, todayIso } from '../../lib/dates'
import { relativeTime } from '../../lib/format'
import { leaveColors } from '../shifts/leave'
import { ConfirmDialog } from '../users/Dialogs'
import {
  useAddAdjustment,
  useAdjustments,
  useDeleteHoliday,
  useHolidays,
  useLeaveBalances,
  useLeaveCalendar,
  useSaveHoliday,
  type Holiday,
  type LeaveBalance,
} from './api'

type Tab = 'calendar' | 'balances' | 'holidays'

/** İzinler: ekip izin takvimi, yıllık izin bakiyeleri ve resmi tatil takvimi. */
export function LeavePage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('calendar')
  return (
    <>
      <PageHeader title={t('leave.title')} subtitle={t('leave.subtitle')} />
      <div className="mb-5">
        <Segmented<Tab>
          label={t('leave.title')}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'calendar', label: t('leave.tabs.calendar') },
            { value: 'balances', label: t('leave.tabs.balances') },
            { value: 'holidays', label: t('leave.tabs.holidays') },
          ]}
        />
      </div>
      {tab === 'calendar' ? <CalendarTab /> : tab === 'balances' ? <BalancesTab /> : <HolidaysTab />}
    </>
  )
}

// ---------- Takvim ----------

function monthRange(anchor: string) {
  const d = parseDate(anchor)
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return { from: isoDate(first), to: isoDate(last) }
}

function CalendarTab() {
  const { t } = useTranslation()
  const [anchor, setAnchor] = useState(() => todayIso().slice(0, 8) + '01')
  const { from, to } = monthRange(anchor)
  const cal = useLeaveCalendar(from, to)
  const today = todayIso()

  const days: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d)
  const holidays = new Map((cal.data?.holidays ?? []).map((h) => [h.date, h]))
  const shift = (months: number) => {
    const d = parseDate(anchor)
    setAnchor(isoDate(new Date(d.getFullYear(), d.getMonth() + months, 1)))
  }

  return (
    <section className="rounded-2xl bg-panel ring-1 ring-line">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-1">
          <IconButton label={t('leave.prevMonth')} onClick={() => shift(-1)}>
            <ChevronLeft className="size-5" />
          </IconButton>
          <h2 className="min-w-36 text-center font-semibold first-letter:uppercase">{formatDay(from, { month: 'long', year: 'numeric' })}</h2>
          <IconButton label={t('leave.nextMonth')} onClick={() => shift(1)}>
            <ChevronRight className="size-5" />
          </IconButton>
        </div>
        <Legend />
      </div>

      {!cal.data ? (
        <div className="p-4">
          <PageSkeleton variant="table" />
        </div>
      ) : (
        <div className={`overflow-x-auto ${cal.isPlaceholderData ? 'opacity-60' : ''}`}>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-[1] min-w-40 bg-panel px-4 py-2 text-left font-normal text-ink-soft">{t('leave.person')}</th>
                {days.map((d) => {
                  const h = holidays.get(d)
                  const dow = parseDate(d).getDay()
                  return (
                    <th
                      key={d}
                      title={h?.name}
                      className={`w-8 min-w-8 border-l border-line py-1.5 text-center font-normal ${h ? 'bg-[#7c5cc4]/12 text-[#5b3c99] dark:text-[#b9a3ef]' : dow === 0 || dow === 6 ? 'bg-panel-2' : ''} ${d === today ? 'font-semibold text-signal' : 'text-ink-soft'}`}
                    >
                      <span className="block text-[10px] uppercase">{formatDay(d, { weekday: 'narrow' })}</span>
                      <span className="tabular block">{parseDate(d).getDate()}</span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {cal.data.people.map((p) => {
                const byDate = new Map(p.days.map((x) => [x.date, x]))
                return (
                  <tr key={p.userId} className="border-t border-line">
                    <th scope="row" className="sticky left-0 z-[1] truncate bg-panel px-4 py-2 text-left font-medium">
                      {p.name}
                    </th>
                    {days.map((d) => {
                      const x = byDate.get(d)
                      const h = holidays.get(d)
                      return (
                        <td key={d} className={`h-9 border-l border-line p-0.5 ${h && !h.isHalfDay ? 'bg-[#7c5cc4]/8' : ''}`}>
                          {x && (
                            <span
                              title={`${t(`shifts.kinds.${x.kind}`)}${x.pending ? ` · ${t('leave.pending')}` : ''}`}
                              className={`block h-full w-full rounded-md ${x.pending ? 'opacity-45' : ''}`}
                              style={{
                                backgroundColor: leaveColors[x.kind],
                                backgroundImage: x.pending ? 'repeating-linear-gradient(45deg, transparent 0 4px, rgba(255,255,255,.55) 4px 7px)' : undefined,
                              }}
                            />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {cal.data.people.length === 0 && <p className="p-8 text-center text-ink-soft">{t('leave.noStaff')}</p>}
        </div>
      )}
    </section>
  )
}

function Legend() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
      {(['AnnualLeave', 'SickLeave', 'ExcusedLeave'] as const).map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: leaveColors[k] }} />
          {t(`shifts.kinds.${k}`)}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-ink-soft/40" />
        {t('leave.pending')}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-[#7c5cc4]/40" />
        {t('leave.holiday')}
      </span>
    </div>
  )
}

// ---------- Bakiyeler ----------

function BalancesTab() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const balances = useLeaveBalances()
  const [adjusting, setAdjusting] = useState<LeaveBalance | null>(null)
  const canManage = can(user, 'leave.manage')

  if (!balances.data) return <PageSkeleton variant="table" />

  return (
    <>
      <section className="overflow-x-auto rounded-2xl bg-panel ring-1 ring-line">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-soft">
              <th className="px-5 py-3 font-normal">{t('leave.person')}</th>
              <th className="px-3 py-3 font-normal">{t('leave.cols.service')}</th>
              <th className="px-3 py-3 text-right font-normal">{t('leave.balance.earned')}</th>
              <th className="px-3 py-3 text-right font-normal">{t('leave.balance.adjustments')}</th>
              <th className="px-3 py-3 text-right font-normal">{t('leave.balance.used')}</th>
              <th className="px-3 py-3 text-right font-normal">{t('leave.balance.pending')}</th>
              <th className="px-3 py-3 text-right font-normal">{t('leave.cols.remaining')}</th>
              <th className="px-3 py-3 font-normal">{t('leave.balance.next')}</th>
              {canManage && <th className="px-3 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {balances.data.map((b) => (
              <tr key={b.userId}>
                <td className="px-5 py-3 font-medium">{b.name}</td>
                <td className="px-3 py-3 text-ink-soft">
                  {b.hireDate ? t('leave.cols.years', { count: b.serviceYears }) : <span className="text-pause">{t('leave.noHireDate')}</span>}
                </td>
                <td className="tabular px-3 py-3 text-right">{b.earned}</td>
                <td className="tabular px-3 py-3 text-right">{b.adjustments === 0 ? '–' : b.adjustments > 0 ? `+${b.adjustments}` : b.adjustments}</td>
                <td className="tabular px-3 py-3 text-right">{b.used}</td>
                <td className="tabular px-3 py-3 text-right">{b.pending || '–'}</td>
                <td className={`tabular px-3 py-3 text-right font-semibold ${b.remaining < 0 ? 'text-overrun' : ''}`}>{b.remaining}</td>
                <td className="px-3 py-3 text-ink-soft">
                  {b.nextEarnedOn && t('leave.balance.nextValue', { date: formatDay(b.nextEarnedOn, { day: 'numeric', month: 'short', year: 'numeric' }), days: b.nextDays })}
                </td>
                {canManage && (
                  <td className="px-3 py-3 text-right">
                    {b.userId !== user?.id && (
                      <Button variant="ghost" size="sm" onClick={() => setAdjusting(b)}>
                        {t('leave.adjust')}
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="mt-3 text-xs text-ink-soft">{t('leave.rules')}</p>
      {adjusting && <AdjustDialog balance={adjusting} onClose={() => setAdjusting(null)} />}
    </>
  )
}

function AdjustDialog({ balance, onClose }: { balance: LeaveBalance; onClose: () => void }) {
  const { t } = useTranslation()
  const history = useAdjustments(balance.userId)
  const add = useAddAdjustment()
  const [days, setDays] = useState('')
  const [reason, setReason] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      await add.mutateAsync({ userId: balance.userId, days: Number(days), reason: reason.trim() })
      toast.success(t('leave.adjusted'))
      onClose()
    } catch (err) {
      toast.error(errorMessage(err, t))
    }
  }

  return (
    <Dialog open onClose={onClose} title={t('leave.adjustTitle', { name: balance.name })} maxWidth="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-ink-soft">{t('leave.adjustHint')}</p>
        <div className="grid grid-cols-[8rem_1fr] gap-3">
          <Field label={t('leave.adjustDays')}>
            {(p) => <Input {...p} type="number" min={-365} max={365} step={1} required value={days} onChange={(e) => setDays(e.target.value)} placeholder="+5 / -2" />}
          </Field>
          <Field label={t('leave.adjustReason')}>
            {(p) => <Input {...p} required minLength={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('leave.adjustReasonPlaceholder')} />}
          </Field>
        </div>
        {(history.data?.length ?? 0) > 0 && (
          <ul className="max-h-40 space-y-1.5 overflow-y-auto rounded-xl bg-panel-2 p-3 text-sm ring-1 ring-line">
            {history.data!.map((a) => (
              <li key={a.id} className="flex gap-3">
                <span className={`tabular w-10 shrink-0 font-semibold ${a.days > 0 ? 'text-signal' : 'text-overrun'}`}>{a.days > 0 ? `+${a.days}` : a.days}</span>
                <span className="min-w-0 flex-1">{a.reason}</span>
                <span className="shrink-0 text-xs text-ink-soft">{relativeTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={add.isPending} disabled={!days || Number(days) === 0 || reason.trim().length < 3}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

// ---------- Resmi tatiller ----------

function HolidaysTab() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [year, setYear] = useState(() => new Date().getFullYear())
  const list = useHolidays(year)
  const remove = useDeleteHoliday()
  const [editing, setEditing] = useState<Holiday | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Holiday | null>(null)
  const canManage = can(user, 'leave.manage')

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <IconButton label={t('leave.prevYear')} onClick={() => setYear((y) => y - 1)}>
            <ChevronLeft className="size-5" />
          </IconButton>
          <span className="tabular min-w-16 text-center text-lg font-semibold">{year}</span>
          <IconButton label={t('leave.nextYear')} onClick={() => setYear((y) => y + 1)}>
            <ChevronRight className="size-5" />
          </IconButton>
        </div>
        {canManage && (
          <Button variant="secondary" onClick={() => setEditing('new')}>
            <Plus className="size-4" />
            {t('leave.addHoliday')}
          </Button>
        )}
      </div>

      {!list.data ? (
        <PageSkeleton variant="list" />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-panel ring-1 ring-line">
          {list.data.length === 0 && <li className="p-8 text-center text-ink-soft">{t('leave.noHolidays')}</li>}
          {list.data.map((h) => (
            <li key={h.id} className="flex items-center gap-4 px-5 py-3">
              <span className="tabular w-28 shrink-0 text-sm text-ink-soft first-letter:uppercase">
                {formatDay(h.date, { day: 'numeric', month: 'long', weekday: 'short' })}
              </span>
              <span className="min-w-0 flex-1 font-medium">{h.name}</span>
              {h.isHalfDay && <Badge tone="pause">{t('leave.halfDay')}</Badge>}
              {canManage && (
                <span className="flex">
                  <IconButton label={t('common.edit')} onClick={() => setEditing(h)}>
                    <Pencil className="size-4" />
                  </IconButton>
                  <IconButton label={t('leave.deleteHoliday')} onClick={() => setDeleting(h)}>
                    <Trash2 className="size-4" />
                  </IconButton>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-ink-soft">{t('leave.holidaysHint')}</p>

      {editing && <HolidayDialog holiday={editing === 'new' ? null : editing} year={year} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title={t('leave.deleteHoliday')}
        body={t('leave.deleteHolidayBody', { name: deleting?.name ?? '' })}
        confirmLabel={t('leave.deleteHoliday')}
        tone="danger"
        loading={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(deleting!.id)
            setDeleting(null)
          } catch (err) {
            toast.error(errorMessage(err, t))
          }
        }}
      />
    </>
  )
}

function HolidayDialog({ holiday, year, onClose }: { holiday: Holiday | null; year: number; onClose: () => void }) {
  const { t } = useTranslation()
  const save = useSaveHoliday()
  const [date, setDate] = useState(holiday?.date ?? `${year}-01-01`)
  const [name, setName] = useState(holiday?.name ?? '')
  const [half, setHalf] = useState(holiday?.isHalfDay ?? false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      await save.mutateAsync({ id: holiday?.id, date, name: name.trim(), isHalfDay: half })
      onClose()
    } catch (err) {
      toast.error(errorMessage(err, t))
    }
  }

  return (
    <Dialog open onClose={onClose} title={holiday ? t('leave.editHoliday') : t('leave.addHoliday')}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('leave.holidayDate')}>{(p) => <Input {...p} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Field label={t('leave.holidayName')}>{(p) => <Input {...p} required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--color-signal)]" checked={half} onChange={(e) => setHalf(e.target.checked)} />
          {t('leave.halfDayLabel')}
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!name.trim() || !date}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
