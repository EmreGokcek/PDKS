import { useAuth } from '../../auth/AuthContext'
import { can } from '../../auth/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { BellRing, CalendarDays, Coffee, Lock, TimerReset, Watch } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { PageHeader } from '../../components/AppShell'
import { Button } from '../../components/ui/Button'
import { Segmented } from '../../components/ui/Segmented'
import { api, errorMessage, json } from '../../lib/api'
import { formatDuration, formatMinutes } from '../../lib/format'
import { PageSkeleton } from '../../components/ui/Skeleton'

type WeekDay = 'Monday' | 'Sunday' | 'Saturday'

interface WorkRules {
  weeklyWorkMinutes: number
  dailyBreakMinutes: number
  lateToleranceMinutes: number
  weekStartsOn: WeekDay
  notArrivedAlertMinutes: number
  breakOverrunAlert: boolean
}

const LIMITS = {
  weekly: { min: 60, max: 70 * 60 },
  break: { min: 0, max: 240 },
  tolerance: { min: 0, max: 120 },
  alert: { min: 0, max: 240 },
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(v) ? v : min))

export function WorkRulesPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const readOnly = !can(user, 'rules.manage')
  const qc = useQueryClient()
  const query = useQuery({ queryKey: ['work-rules'], queryFn: () => api<WorkRules>('/settings/work-rules') })
  // Kullanıcı bir şeyi değiştirene kadar taslak yok; sunucudaki değer gösterilir.
  const [edited, setEdited] = useState<WorkRules | null>(null)

  const save = useMutation({
    mutationFn: (rules: WorkRules) => api<WorkRules>('/settings/work-rules', { method: 'PUT', ...json(rules) }),
    onSuccess: (data) => {
      qc.setQueryData(['work-rules'], data)
      setEdited(null)
      toast.success(t('rules.saved'))
    },
    onError: (err) => toast.error(errorMessage(err, t)),
  })

  if (query.isPending || !query.data) {
    return (
      <>
        <PageHeader title={t('rules.title')} subtitle={t('rules.subtitle')} />
        <PageSkeleton variant="grid" />
      </>
    )
  }

  const original = query.data
  const draft = edited ?? original
  const dirty = JSON.stringify(original) !== JSON.stringify(draft)
  const set = (patch: Partial<WorkRules>) => setEdited({ ...draft, ...patch })

  const weeklyHours = Math.floor(draft.weeklyWorkMinutes / 60)
  const weeklyMinutes = draft.weeklyWorkMinutes % 60

  return (
    <>
      <PageHeader title={t('rules.title')} subtitle={t('rules.subtitle')} />

      {readOnly && (
        <p className="mb-6 flex items-center gap-2.5 rounded-xl bg-panel-2 px-4 py-3 text-sm text-ink-soft ring-1 ring-line">
          <Lock className="size-4" />
          {t('rules.readOnly')}
        </p>
      )}

      {/* Canlı özet: kuralların bir cümlelik karşılığı */}
      <motion.p
        layout
        className="mb-6 rounded-2xl bg-brand px-6 py-5 text-lg leading-relaxed text-on-brand"
      >
        {t('rules.summary', {
          weekly: formatDuration(draft.weeklyWorkMinutes),
          break: formatMinutes(draft.dailyBreakMinutes),
          tolerance: formatMinutes(draft.lateToleranceMinutes),
        })}
      </motion.p>

      <fieldset disabled={readOnly} className="grid gap-4 md:grid-cols-2">
        <RuleCard icon={<Watch className="size-5" />} title={t('rules.weekly')} hint={t('rules.weeklyHint')}>
          <div className="flex items-end gap-3">
            <NumberBox
              label={t('common.hours')}
              value={weeklyHours}
              min={1}
              max={70}
              onChange={(h) => set({ weeklyWorkMinutes: clamp(h * 60 + weeklyMinutes, LIMITS.weekly.min, LIMITS.weekly.max) })}
            />
            <NumberBox
              label={t('common.minutes')}
              value={weeklyMinutes}
              min={0}
              max={59}
              step={15}
              onChange={(m) => set({ weeklyWorkMinutes: clamp(weeklyHours * 60 + m, LIMITS.weekly.min, LIMITS.weekly.max) })}
            />
          </div>
          <Presets
            values={[40 * 60, 45 * 60, 48 * 60]}
            current={draft.weeklyWorkMinutes}
            onPick={(v) => set({ weeklyWorkMinutes: v })}
          />
        </RuleCard>

        <RuleCard icon={<Coffee className="size-5" />} title={t('rules.break')} hint={t('rules.breakHint')}>
          <NumberBox
            label={t('common.minutes')}
            value={draft.dailyBreakMinutes}
            min={LIMITS.break.min}
            max={LIMITS.break.max}
            step={5}
            onChange={(v) => set({ dailyBreakMinutes: clamp(v, LIMITS.break.min, LIMITS.break.max) })}
          />
          <Presets values={[30, 45, 60, 90]} format={formatMinutes} current={draft.dailyBreakMinutes} onPick={(v) => set({ dailyBreakMinutes: v })} />
        </RuleCard>

        <RuleCard icon={<TimerReset className="size-5" />} title={t('rules.tolerance')} hint={t('rules.toleranceHint')}>
          <NumberBox
            label={t('common.minutes')}
            value={draft.lateToleranceMinutes}
            min={LIMITS.tolerance.min}
            max={LIMITS.tolerance.max}
            onChange={(v) => set({ lateToleranceMinutes: clamp(v, LIMITS.tolerance.min, LIMITS.tolerance.max) })}
          />
          <Presets values={[0, 5, 10, 15]} format={formatMinutes} current={draft.lateToleranceMinutes} onPick={(v) => set({ lateToleranceMinutes: v })} />
        </RuleCard>

        <RuleCard icon={<CalendarDays className="size-5" />} title={t('rules.weekStart')} hint={t('rules.weekStartHint')}>
          <Segmented<WeekDay>
            label={t('rules.weekStart')}
            value={draft.weekStartsOn}
            onChange={(v) => !readOnly && set({ weekStartsOn: v })}
            options={(['Monday', 'Sunday', 'Saturday'] as WeekDay[]).map((d) => ({ value: d, label: t(`days.${d}`) }))}
          />
        </RuleCard>

        <RuleCard icon={<BellRing className="size-5" />} title={t('rules.alerts')} hint={t('rules.alertsHint')}>
          <Toggle
            label={t('rules.notArrivedAlert')}
            checked={draft.notArrivedAlertMinutes > 0}
            onChange={(on) => set({ notArrivedAlertMinutes: on ? 15 : 0 })}
          />
          {draft.notArrivedAlertMinutes > 0 && (
            <>
              <NumberBox
                label={t('rules.notArrivedAfter')}
                value={draft.notArrivedAlertMinutes}
                min={1}
                max={LIMITS.alert.max}
                step={5}
                onChange={(v) => set({ notArrivedAlertMinutes: clamp(v, 1, LIMITS.alert.max) })}
              />
              <Presets values={[10, 15, 30, 60]} format={formatMinutes} current={draft.notArrivedAlertMinutes} onPick={(v) => set({ notArrivedAlertMinutes: v })} />
            </>
          )}
          <Toggle label={t('rules.breakOverrunAlert')} checked={draft.breakOverrunAlert} onChange={(on) => set({ breakOverrunAlert: on })} />
        </RuleCard>
      </fieldset>

      {/* Kaydedilmemiş değişiklik olduğunda alttan kayan kaydetme çubuğu */}
      <AnimatePresence>
        {dirty && !readOnly && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="sticky bottom-4 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-panel px-5 py-3.5 shadow-pop ring-1 ring-line"
          >
            <span className="flex items-center gap-2.5 text-sm font-medium">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-pause opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-pause" />
              </span>
              {t('rules.unsaved')}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEdited(null)} disabled={save.isPending}>
                {t('common.cancel')}
              </Button>
              <Button size="sm" onClick={() => save.mutate(draft)} loading={save.isPending}>
                {save.isPending ? t('common.saving') : t('common.save')}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function RuleCard({ icon, title, hint, children }: { icon: ReactNode; title: string; hint: string; children: ReactNode }) {
  return (
    <section className="flex flex-col rounded-2xl bg-panel p-5 ring-1 ring-line">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-signal-soft text-signal">{icon}</span>
        <h2 className="font-semibold">{title}</h2>
      </div>
      <p className="mt-3 text-sm text-ink-soft">{hint}</p>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  )
}

/** Aç / kapa anahtarı. */
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span className="text-sm font-medium">{label}</span>
      <input type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-signal peer-focus-visible:ring-offset-2 ${checked ? 'bg-signal' : 'bg-line'}`}
      >
        <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </span>
    </label>
  )
}

/** Artı / eksi düğmeli sayı kutusu. */
function NumberBox({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}) {
  const btn = 'grid size-11 place-items-center text-xl text-ink-soft transition-colors hover:bg-panel-2 hover:text-ink disabled:opacity-30'
  return (
    <label className="inline-block">
      <span className="mb-1.5 block text-xs text-ink-soft">{label}</span>
      <span className="inline-flex items-center overflow-hidden rounded-xl ring-1 ring-line focus-within:ring-2 focus-within:ring-signal">
        <button type="button" className={btn} onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min} aria-label="−">
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          className="tabular w-16 bg-transparent text-center text-xl font-semibold focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(clamp(parseInt(e.target.value, 10), min, max))}
        />
        <button type="button" className={btn} onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max} aria-label="+">
          +
        </button>
      </span>
    </label>
  )
}

function Presets({
  values,
  current,
  onPick,
  format = formatDuration,
}: {
  values: number[]
  current: number
  onPick: (v: number) => void
  format?: (minutes: number) => string
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onPick(v)}
          className={`rounded-full px-3 py-1 text-sm ring-1 transition-colors ${current === v ? 'bg-signal-soft text-signal ring-signal/30' : 'text-ink-soft ring-line hover:text-ink'}`}
        >
          {format(v)}
        </button>
      ))}
    </div>
  )
}
