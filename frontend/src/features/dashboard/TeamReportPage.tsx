import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/AppShell'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Button, IconButton } from '../../components/ui/Button'
import { Sheet } from '../../components/ui/Overlay'
import { api } from '../../lib/api'
import { addDays, formatDay, formatRange, hhmm, todayIso, weekStartOf, type WeekDayName } from '../../lib/dates'
import { formatMinutes, formatSeconds, formatTime } from '../../lib/format'
import { isLeave, leaveColors } from '../shifts/leave'
import { useAuth } from '../../auth/AuthContext'
import { DayEditor, type DayEditorTarget } from '../corrections/DayEditor'
import { usePersonReport, useTeamReport, type DayRecord, type ReportPerson } from './api'
import { statusTone } from './status'
import { PageSkeleton } from '../../components/ui/Skeleton'
import { Spinner } from '../../components/ui/Spinner'

/** Haftalık ekip süreleri: kişi başına çalışma, fazla mesai, geç kalma, devamsızlık. */
export function TeamReportPage() {
  const { t } = useTranslation()
  const rules = useQuery({
    queryKey: ['work-rules'],
    queryFn: () => api<{ weekStartsOn: WeekDayName }>('/settings/work-rules'),
  })
  const [offset, setOffset] = useState(0)
  const from = rules.data ? addDays(weekStartOf(todayIso(), rules.data.weekStartsOn), offset * 7) : null
  const to = from ? addDays(from, 6) : null
  const report = useTeamReport(from, to)
  const [selected, setSelected] = useState<ReportPerson | null>(null)

  const people = report.data?.people ?? []
  const total = (pick: (p: ReportPerson) => number) => people.reduce((s, p) => s + pick(p), 0)

  return (
    <>
      <PageHeader
        title={t('reports.title')}
        subtitle={from && to ? formatRange(from, to) : ' '}
        actions={
          <div className="flex items-center rounded-xl ring-1 ring-line">
            <IconButton label={t('shifts.prevWeek')} onClick={() => setOffset((o) => o - 1)}>
              <ChevronLeft className="size-5" />
            </IconButton>
            <button
              type="button"
              onClick={() => setOffset(0)}
              className={`px-2 text-sm font-medium ${offset === 0 ? 'text-ink' : 'text-ink-soft hover:text-ink'}`}
            >
              {t('shifts.thisWeek')}
            </button>
            <IconButton label={t('shifts.nextWeek')} onClick={() => setOffset((o) => o + 1)} disabled={offset >= 0}>
              <ChevronRight className="size-5" />
            </IconButton>
          </div>
        }
      />

      {report.isPending || !report.data ? (
        <PageSkeleton variant="table" />
      ) : people.length === 0 ? (
        <p className="rounded-2xl bg-panel p-8 text-center text-ink-soft ring-1 ring-line">{t('reports.empty')}</p>
      ) : (
        <section className={`overflow-x-auto rounded-2xl bg-panel ring-1 ring-line transition-opacity ${report.isPlaceholderData ? 'opacity-60' : ''}`}>
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-soft">
                <th className="px-5 py-3 font-normal">{t('reports.person')}</th>
                <th className="px-3 py-3 font-normal">{t('reports.worked')} / {t('reports.planned')}</th>
                <th className="px-3 py-3 font-normal">{t('reports.overtime')}</th>
                <th className="px-3 py-3 font-normal">{t('reports.late')}</th>
                <th className="px-3 py-3 font-normal">{t('reports.early')}</th>
                <th className="px-3 py-3 font-normal">{t('reports.breakOverrun')}</th>
                <th className="px-3 py-3 font-normal">{t('reports.absent')}</th>
                <th className="px-3 py-3 font-normal">{t('reports.leave')}</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p, i) => {
                const ratio = p.plannedSeconds > 0 ? Math.min(1, p.workedSeconds / p.plannedSeconds) : 0
                return (
                  <motion.tr
                    key={p.userId}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 12) * 0.025 } }}
                    onClick={() => setSelected(p)}
                    className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-panel-2/70"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={p.name} size="sm" muted={!p.isActive} />
                        <span className="font-medium">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="tabular">
                        {formatSeconds(p.workedSeconds)} <span className="text-ink-soft">/ {formatSeconds(p.plannedSeconds)}</span>
                      </span>
                      <div className="mt-1.5 h-1 w-32 overflow-hidden rounded-full bg-panel-2">
                        <motion.div className="h-full rounded-full bg-signal" initial={{ width: 0 }} animate={{ width: `${ratio * 100}%` }} />
                      </div>
                    </td>
                    <Num value={p.overtimeSeconds} tone="pause">{formatSeconds(p.overtimeSeconds)}</Num>
                    <Num value={p.lateCount} tone="overrun">{t('reports.lateDetail', { count: p.lateCount, minutes: p.lateMinutes })}</Num>
                    <Num value={p.earlyLeaveCount} tone="pause">{t('reports.times', { count: p.earlyLeaveCount })}</Num>
                    <Num value={p.breakOverrunSeconds} tone="pause">{formatSeconds(p.breakOverrunSeconds)}</Num>
                    <Num value={p.absentCount} tone="overrun">{t('reports.days', { count: p.absentCount })}</Num>
                    <Num value={p.leaveCount} tone="brand">{t('reports.days', { count: p.leaveCount })}</Num>
                  </motion.tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-line bg-panel-2/60 font-medium">
                <td className="px-5 py-3">{t('reports.total')}</td>
                <td className="tabular px-3 py-3">
                  {formatSeconds(total((p) => p.workedSeconds))} <span className="text-ink-soft">/ {formatSeconds(total((p) => p.plannedSeconds))}</span>
                </td>
                <td className="tabular px-3 py-3">{formatSeconds(total((p) => p.overtimeSeconds))}</td>
                <td className="tabular px-3 py-3">{t('reports.times', { count: total((p) => p.lateCount) })}</td>
                <td className="tabular px-3 py-3">{t('reports.times', { count: total((p) => p.earlyLeaveCount) })}</td>
                <td className="tabular px-3 py-3">{formatSeconds(total((p) => p.breakOverrunSeconds))}</td>
                <td className="tabular px-3 py-3">{t('reports.days', { count: total((p) => p.absentCount) })}</td>
                <td className="tabular px-3 py-3">{t('reports.days', { count: total((p) => p.leaveCount) })}</td>
              </tr>
            </tfoot>
          </table>
        </section>
      )}

      <PersonSheet person={selected} from={from} to={to} onClose={() => setSelected(null)} />
    </>
  )
}

/** Sıfırsa sönük "—", değilse renkli değer. */
function Num({ value, tone, children }: { value: number; tone: 'pause' | 'overrun' | 'brand'; children: ReactNode }) {
  const { t } = useTranslation()
  const color = { pause: 'text-pause', overrun: 'text-overrun', brand: 'text-ink' }[tone]
  return <td className={`tabular px-3 py-3 ${value > 0 ? `font-medium ${color}` : 'text-ink-soft/60'}`}>{value > 0 ? children : t('reports.none')}</td>
}

function PersonSheet({ person, from, to, onClose }: { person: ReportPerson | null; from: string | null; to: string | null; onClose: () => void }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const detail = usePersonReport(person?.userId ?? null, from, to)
  const [editing, setEditing] = useState<DayEditorTarget | null>(null)
  const canEdit = person && person.userId !== user?.id
  return (
    <Sheet open={!!person} onClose={onClose} closeLabel={t('common.close')} title={person?.name ?? ''} description={t('reports.detail')}>
      {detail.isPending || !detail.data ? (
        <div className="grid place-items-center py-16 text-ink-soft">
          <Spinner />
        </div>
      ) : (
        <ol className="space-y-2">
          {detail.data.days.map((d) => (
            <DayRow
              key={d.date}
              day={d}
              onEdit={
                canEdit && d.date <= todayIso()
                  ? () => setEditing({ userId: person.userId, name: person.name, date: d.date, plan: d.plan && !isLeave(d.plan.kind) ? d.plan : null })
                  : undefined
              }
            />
          ))}
        </ol>
      )}
      <DayEditor target={editing} onClose={() => setEditing(null)} />
    </Sheet>
  )
}

function DayRow({ day: d, onEdit }: { day: DayRecord; onEdit?: () => void }) {
  const { t } = useTranslation()
  const plan = d.plan
  const leave = plan && isLeave(plan.kind)
  return (
    <li className="rounded-xl bg-panel-2/60 p-3.5 ring-1 ring-line">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium first-letter:uppercase">{formatDay(d.date, { weekday: 'long', day: 'numeric', month: 'short' })}</p>
          <p className="text-xs text-ink-soft">
            {leave ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: leaveColors[plan!.kind as keyof typeof leaveColors] }} />
                {t(`shifts.kinds.${plan!.kind}`)}
              </span>
            ) : plan ? (
              `${t('reports.plan')}: ${hhmm(plan.startTime)}–${hhmm(plan.endTime)}${plan.name ? ` · ${plan.name}` : ''}`
            ) : (
              t('dashboard.noShift')
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={statusTone[d.status]} dot>
            {t(`dashboard.status.${d.status}`)}
          </Badge>
          {onEdit && (
            <Button variant="secondary" size="sm" onClick={onEdit}>
              {t('corrections.button')}
            </Button>
          )}
        </div>
      </div>

      {(d.firstIn || d.workedSeconds > 0) && (
        <dl className="mt-3 grid grid-cols-4 gap-2 text-sm">
          <Cell label={t('reports.firstIn')} value={d.firstIn ? formatTime(d.firstIn) : '—'} />
          <Cell label={t('reports.lastOut')} value={d.lastOut ? formatTime(d.lastOut) : '—'} />
          <Cell label={t('reports.worked')} value={formatSeconds(d.workedSeconds)} />
          <Cell label={t('reports.break')} value={formatMinutes(Math.round(d.breakSeconds / 60))} />
        </dl>
      )}

      {(d.lateMinutes > 0 || d.earlyLeaveMinutes > 0 || d.breakOverrunSeconds > 0 || d.hasUnclosedSession) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {d.lateMinutes > 0 && <Badge tone="overrun">{t('dashboard.lateBy', { minutes: d.lateMinutes })}</Badge>}
          {d.earlyLeaveMinutes > 0 && <Badge tone="pause">{t('dashboard.earlyBy', { minutes: d.earlyLeaveMinutes })}</Badge>}
          {d.breakOverrunSeconds > 0 && <Badge tone="pause">{t('dashboard.breakOver', { time: formatSeconds(d.breakOverrunSeconds) })}</Badge>}
          {d.hasUnclosedSession && <Badge tone="pause">{t('dashboard.unclosed')}</Badge>}
        </div>
      )}
    </li>
  )
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="tabular font-medium">{value}</dd>
    </div>
  )
}
