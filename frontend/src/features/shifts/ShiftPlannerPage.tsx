import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Clock, Copy, Eraser, LayoutTemplate, MousePointer2, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { PageHeader } from '../../components/AppShell'
import { Avatar } from '../../components/ui/Avatar'
import { Button, IconButton } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { Dialog } from '../../components/ui/Overlay'
import { Spinner } from '../../components/ui/Spinner'
import { api, errorMessage } from '../../lib/api'
import { addDays, formatDay, formatRange, hhmm, isOvernight, shiftMinutes, todayIso, toApiTime, weekDays, weekStartOf, type WeekDayName } from '../../lib/dates'
import { formatDuration } from '../../lib/format'
import { ConfirmDialog } from '../users/Dialogs'
import { useAssignShifts, useClearShifts, useCopyWeek, usePlanner, useTemplates, type Cell, type Shift } from './api'
import { CellDialog, type CellTarget } from './CellDialog'
import { isLeave, leaveColors, leaveKinds, matchTemplate, netWorkMinutes, type LeaveKind } from './leave'
import { LeaveChip, ShiftChip } from './ShiftChip'
import { TemplatesSheet } from './TemplatesSheet'

type Brush =
  | { kind: 'template'; id: string }
  | { kind: 'custom'; start: string; end: string }
  | { kind: 'leave'; leave: LeaveKind }
  | { kind: 'erase' }
  | null

const cellKey = (c: Cell) => `${c.userId}|${c.date}`

/** Haftalık vardiya planı: kişiler satırda, günler sütunda. Fırça ile hızlı atama. */
export function ShiftPlannerPage() {
  const { t } = useTranslation()
  const rules = useQuery({
    queryKey: ['work-rules'],
    queryFn: () => api<{ weekStartsOn: WeekDayName; dailyBreakMinutes: number; weeklyWorkMinutes: number }>('/settings/work-rules'),
  })
  const weekStartsOn = rules.data?.weekStartsOn ?? 'Monday'
  const [offset, setOffset] = useState(0)
  const weekStart = rules.data ? addDays(weekStartOf(todayIso(), weekStartsOn), offset * 7) : null

  const planner = usePlanner(weekStart)
  const templates = useTemplates()
  const tpls = useMemo(() => templates.data ?? [], [templates.data])
  const assign = useAssignShifts(weekStart ?? '', tpls)
  const clear = useClearShifts(weekStart ?? '')
  const copyWeek = useCopyWeek()

  const [brush, setBrush] = useState<Brush>(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [copyOpen, setCopyOpen] = useState(false)
  const [overwrite, setOverwrite] = useState(false)
  const [editing, setEditing] = useState<CellTarget | null>(null)

  const data = planner.data
  const days = weekStart ? weekDays(weekStart) : []
  const today = todayIso()

  const shiftsByCell = useMemo(() => {
    const map = new Map<string, Shift>()
    data?.shifts.forEach((s) => map.set(cellKey(s), s))
    return map
  }, [data?.shifts])

  // ---- Kaydetme ----
  const handleError = useCallback((err: unknown) => toast.error(errorMessage(err, t)), [t])

  const applyBrush = useCallback(
    (cells: Cell[], b: Exclude<Brush, null>) => {
      if (cells.length === 0) return
      if (b.kind === 'erase') {
        const filled = cells.filter((c) => shiftsByCell.has(cellKey(c)))
        if (filled.length) clear.mutate(filled, { onError: handleError })
      } else if (b.kind === 'template') {
        assign.mutate({ cells, templateId: b.id }, { onError: handleError })
      } else if (b.kind === 'leave') {
        assign.mutate({ cells, kind: b.leave }, { onError: handleError })
      } else {
        assign.mutate({ cells, startTime: toApiTime(b.start), endTime: toApiTime(b.end) }, { onError: handleError })
      }
    },
    [assign, clear, shiftsByCell, handleError],
  )

  // ---- Sürükleyerek boyama (fare ve dokunmatik) ----
  const painting = useRef<Map<string, Cell> | null>(null)
  const [painted, setPainted] = useState<Set<string>>(new Set())

  const cellFromPoint = (x: number, y: number): Cell | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-cell]')
    if (!el?.dataset.user || !el.dataset.date) return null
    return { userId: el.dataset.user, date: el.dataset.date }
  }

  const addToPaint = (cell: Cell) => {
    const map = painting.current
    if (!map || map.has(cellKey(cell))) return
    map.set(cellKey(cell), cell)
    setPainted(new Set(map.keys()))
  }

  useEffect(() => {
    if (!brush) return
    const finish = () => {
      const map = painting.current
      painting.current = null
      setPainted(new Set())
      if (map && map.size) applyBrush([...map.values()], brush)
    }
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    return () => {
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }
  }, [brush, applyBrush])

  // ---- Toplamlar ----
  const dailyBreak = data?.dailyBreakMinutes ?? 60
  const netMinutes = (s: Shift) => (isLeave(s.kind) ? 0 : netWorkMinutes(shiftMinutes(s.startTime, s.endTime), dailyBreak))
  const shiftName = (s: Shift) => s.templateName ?? matchTemplate(s.startTime, s.endTime, tpls)?.name ?? s.note

  const activeTemplate = brush?.kind === 'template' ? tpls.find((x) => x.id === brush.id) : undefined

  if (!weekStart || (planner.isPending && !data)) {
    return (
      <>
        <PageHeader title={t('shifts.plannerTitle')} />
        <div className="grid place-items-center py-24 text-ink-soft">
          <Spinner />
        </div>
      </>
    )
  }

  const prevWeekStart = addDays(weekStart, -7)

  return (
    <>
      <PageHeader
        title={t('shifts.plannerTitle')}
        subtitle={formatRange(weekStart, addDays(weekStart, 6))}
        actions={
          <>
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
              <IconButton label={t('shifts.nextWeek')} onClick={() => setOffset((o) => o + 1)}>
                <ChevronRight className="size-5" />
              </IconButton>
            </div>
            <Button variant="secondary" onClick={() => setCopyOpen(true)}>
              <Copy className="size-4" />
              <span className="hidden sm:inline">{t('shifts.copyPrev')}</span>
            </Button>
          </>
        }
      />

      {/* Fırça paleti */}
      <section className="sticky top-[61px] z-10 -mx-4 mb-4 border-y border-line bg-paper/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:bg-panel/90 lg:top-3">
        <div className="flex flex-wrap items-center gap-2">
          <BrushButton active={brush === null} onClick={() => setBrush(null)} label={<MousePointer2 className="size-4" />} title={t('common.edit')} />
          <span className="mx-1 h-6 w-px bg-line" />
          {tpls.map((tpl) => (
            <BrushButton
              key={tpl.id}
              active={brush?.kind === 'template' && brush.id === tpl.id}
              onClick={() => setBrush({ kind: 'template', id: tpl.id })}
              color={tpl.color}
              label={
                <>
                  <span className="font-medium">{tpl.name}</span>
                  <span className="tabular text-ink-soft">
                    {hhmm(tpl.startTime)}–{hhmm(tpl.endTime)}
                  </span>
                </>
              }
            />
          ))}
          <BrushButton
            active={brush?.kind === 'custom'}
            onClick={() => setCustomOpen(true)}
            label={
              <>
                <Clock className="size-4" />
                {brush?.kind === 'custom' ? `${brush.start}–${brush.end}` : t('shifts.custom')}
              </>
            }
          />
          <span className="mx-1 h-6 w-px bg-line" />
          <span className="text-xs text-ink-soft">{t('shifts.leave')}</span>
          {leaveKinds.map((lk) => (
            <BrushButton
              key={lk}
              active={brush?.kind === 'leave' && brush.leave === lk}
              onClick={() => setBrush({ kind: 'leave', leave: lk })}
              color={leaveColors[lk]}
              label={<span>{t(`shifts.kinds.${lk}`)}</span>}
            />
          ))}
          <span className="mx-1 h-6 w-px bg-line" />
          <BrushButton
            active={brush?.kind === 'erase'}
            onClick={() => setBrush({ kind: 'erase' })}
            label={
              <>
                <Eraser className="size-4" />
                {t('shifts.erase')}
              </>
            }
          />
          <span className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => setTemplatesOpen(true)}>
            <LayoutTemplate className="size-4" />
            {t('shifts.templates')}
          </Button>
        </div>
        <p className="mt-2 text-xs text-ink-soft">{t('shifts.brushHint')}</p>
      </section>

      {data && data.staff.length === 0 ? (
        <p className="rounded-2xl bg-panel p-8 text-center text-ink-soft ring-1 ring-line">{t('shifts.noStaff')}</p>
      ) : (
        <section className={`overflow-x-auto rounded-2xl bg-panel ring-1 ring-line transition-opacity ${planner.isPlaceholderData ? 'opacity-60' : ''}`}>
          <div
            className="grid min-w-[900px] select-none"
            style={{ gridTemplateColumns: '220px repeat(7, minmax(112px, 1fr))', touchAction: brush ? 'none' : 'auto' }}
            onPointerMove={(e) => {
              if (!painting.current) return
              const cell = cellFromPoint(e.clientX, e.clientY)
              if (cell) addToPaint(cell)
            }}
          >
            {/* Başlık satırı */}
            <div className="sticky left-0 z-[1] border-b border-line bg-panel px-4 py-3 text-sm text-ink-soft">{t('shifts.person')}</div>
            {days.map((d) => (
              <div key={d} className={`border-b border-l border-line px-3 py-3 text-center ${d === today ? 'bg-signal-soft/50' : ''}`}>
                <p className="text-xs text-ink-soft first-letter:uppercase">{formatDay(d, { weekday: 'short' })}</p>
                <p className={`tabular text-lg font-semibold ${d === today ? 'text-signal' : ''}`}>{formatDay(d, { day: 'numeric' })}</p>
              </div>
            ))}

            {/* Personel satırları */}
            {data?.staff.map((person) => {
              const rowShifts = days.map((d) => shiftsByCell.get(`${person.id}|${d}`)).filter((s): s is Shift => !!s)
              const planned = rowShifts.reduce((sum, s) => sum + netMinutes(s), 0)
              const leaves = rowShifts.filter((s) => isLeave(s.kind)).length
              const target = data.weeklyWorkMinutes
              const ratio = Math.min(1.2, planned / Math.max(1, target))
              return (
                <Row key={person.id}>
                  <div className="sticky left-0 z-[1] flex items-center gap-3 border-b border-line bg-panel px-4 py-2.5">
                    <Avatar name={person.fullName} size="sm" muted={!person.isActive} />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-medium ${person.isActive ? '' : 'text-ink-soft'}`}>{person.fullName}</p>
                      <p className="tabular text-xs text-ink-soft" title={t('shifts.plannedHint')}>
                        {t('shifts.planned', { planned: formatDuration(planned), target: formatDuration(target) })}
                        {leaves > 0 && <> · {t('shifts.leaveCount', { count: leaves })}</>}
                      </p>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-panel-2">
                        <motion.div
                          className={`h-full rounded-full ${planned > target ? 'bg-pause' : 'bg-signal'}`}
                          animate={{ width: `${Math.min(100, ratio * 100)}%` }}
                          transition={{ duration: 0.4 }}
                        />
                      </div>
                    </div>
                  </div>
                  {days.map((d) => {
                    const key = `${person.id}|${d}`
                    const shift = shiftsByCell.get(key)
                    const isPainted = painted.has(key)
                    return (
                      <button
                        key={d}
                        type="button"
                        data-cell
                        data-user={person.id}
                        data-date={d}
                        aria-label={`${person.fullName} ${formatDay(d, { weekday: 'long', day: 'numeric', month: 'long' })}`}
                        onPointerDown={(e) => {
                          if (!brush) return
                          e.preventDefault()
                          painting.current = new Map()
                          addToPaint({ userId: person.id, date: d })
                        }}
                        onClick={() => {
                          if (brush) return
                          setEditing({
                            userId: person.id,
                            name: person.fullName,
                            date: d,
                            dateLabel: formatDay(d, { weekday: 'long', day: 'numeric', month: 'long' }),
                            shift,
                          })
                        }}
                        className={`group relative h-16 border-b border-l border-line p-1.5 text-left transition-colors ${d === today ? 'bg-signal-soft/25' : ''} ${isPainted ? 'bg-signal-soft' : 'hover:bg-panel-2'} ${brush ? 'cursor-crosshair' : 'cursor-pointer'}`}
                      >
                        <AnimatePresence mode="popLayout" initial={false}>
                          {isPainted && brush?.kind === 'leave' ? (
                            <motion.span key="preview-leave" className="block h-full" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                              <LeaveChip label={t(`shifts.kinds.${brush.leave}`)} color={leaveColors[brush.leave]} pending />
                            </motion.span>
                          ) : isPainted && brush && brush.kind !== 'erase' ? (
                            <motion.span key="preview" className="block h-full" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                              <ShiftChip
                                start={activeTemplate?.startTime ?? (brush.kind === 'custom' ? brush.start : '')}
                                end={activeTemplate?.endTime ?? (brush.kind === 'custom' ? brush.end : '')}
                                name={activeTemplate?.name}
                                color={activeTemplate?.color ?? '#64748b'}
                                pending
                              />
                            </motion.span>
                          ) : shift && !(isPainted && brush?.kind === 'erase') ? (
                            <motion.span
                              key={shift.id + shift.kind + shift.startTime + shift.endTime}
                              className="block h-full"
                              initial={{ scale: 0.92, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.92, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                              title={shift.note ?? undefined}
                            >
                              {isLeave(shift.kind) ? (
                                <LeaveChip label={t(`shifts.kinds.${shift.kind}`)} color={leaveColors[shift.kind]} pending={shift.id.startsWith('tmp-')} />
                              ) : (
                                <ShiftChip
                                  start={shift.startTime}
                                  end={shift.endTime}
                                  name={shiftName(shift)}
                                  color={shift.color}
                                  pending={shift.id.startsWith('tmp-')}
                                />
                              )}
                            </motion.span>
                          ) : (
                            <span key="empty" className="grid h-full place-items-center rounded-lg border border-dashed border-transparent text-ink-soft/0 transition-colors group-hover:border-line group-hover:text-ink-soft/60">
                              <Plus className="size-4" />
                            </span>
                          )}
                        </AnimatePresence>
                      </button>
                    )
                  })}
                </Row>
              )
            })}

            {/* Günlük kişi sayısı */}
            <div className="sticky left-0 z-[1] bg-panel px-4 py-3 text-sm text-ink-soft">{t('shifts.headcount')}</div>
            {days.map((d) => {
              const count = data?.shifts.filter((s) => s.date === d && !isLeave(s.kind)).length ?? 0
              return (
                <div key={d} className="tabular border-l border-line px-3 py-3 text-center text-sm font-medium">
                  {count || '–'}
                </div>
              )
            })}
          </div>
        </section>
      )}

      <CellDialog
        target={editing}
        templates={tpls}
        dailyBreak={dailyBreak}
        onLeave={(kind) => {
          assign.mutate({ cells: [editing!], kind }, { onError: handleError })
          setEditing(null)
        }}
        onClose={() => setEditing(null)}
        onTemplate={(templateId) => {
          assign.mutate({ cells: [editing!], templateId }, { onError: handleError })
          setEditing(null)
        }}
        onCustom={(start, end, note) => {
          assign.mutate({ cells: [editing!], startTime: toApiTime(start), endTime: toApiTime(end), note: note || null }, { onError: handleError })
          setEditing(null)
        }}
        onRemove={() => {
          clear.mutate([editing!], { onError: handleError })
          setEditing(null)
        }}
      />

      <CustomBrushDialog
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        initial={brush?.kind === 'custom' ? brush : { start: '09:00', end: '18:00' }}
        onPick={(start, end) => {
          setBrush({ kind: 'custom', start, end })
          setCustomOpen(false)
        }}
      />

      <TemplatesSheet open={templatesOpen} templates={tpls} onClose={() => setTemplatesOpen(false)} />

      <ConfirmDialog
        open={copyOpen}
        onClose={() => setCopyOpen(false)}
        loading={copyWeek.isPending}
        title={t('shifts.copyTitle')}
        confirmLabel={t('shifts.copyConfirm')}
        body={
          <>
            {t('shifts.copyBody', {
              from: formatDay(prevWeekStart, { day: 'numeric', month: 'long' }),
              to: formatDay(weekStart, { day: 'numeric', month: 'long' }),
            })}
            <label className="mt-4 flex items-center gap-2.5 text-ink">
              <input type="checkbox" className="size-4 accent-[var(--color-signal)]" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
              {t('shifts.copyOverwrite')}
            </label>
          </>
        }
        onConfirm={async () => {
          try {
            const r = await copyWeek.mutateAsync({ fromWeekStart: prevWeekStart, toWeekStart: weekStart, overwrite })
            toast.success(
              r.copied === 0 && r.skipped === 0
                ? t('shifts.copiedNone')
                : r.skipped
                  ? t('shifts.copiedSkipped', { copied: r.copied, skipped: r.skipped })
                  : t('shifts.copied', { copied: r.copied }),
            )
            setCopyOpen(false)
          } catch (err) {
            handleError(err)
          }
        }}
      />
    </>
  )
}

/** Izgarada bir satır; çocuklar doğrudan ızgara hücreleri olsun diye sarmalayıcı yok. */
function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function BrushButton({
  active,
  onClick,
  label,
  color,
  title,
}: {
  active: boolean
  onClick: () => void
  label: React.ReactNode
  color?: string
  title?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      onClick={onClick}
      className={`relative flex h-9 items-center gap-2 rounded-xl px-3 text-sm transition-colors ${active ? 'text-ink' : 'text-ink-soft hover:bg-panel-2 hover:text-ink'}`}
    >
      {active && (
        <motion.span
          layoutId="active-brush"
          className="absolute inset-0 rounded-xl bg-panel shadow-sm ring-2 ring-signal"
          transition={{ type: 'spring', stiffness: 500, damping: 36 }}
        />
      )}
      {color && <span className="relative size-2.5 rounded-full" style={{ backgroundColor: color }} />}
      <span className="relative flex items-center gap-1.5">{label}</span>
    </button>
  )
}

function CustomBrushDialog({
  open,
  initial,
  onPick,
  onClose,
}: {
  open: boolean
  initial: { start: string; end: string }
  onPick: (start: string, end: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onClose={onClose} title={t('shifts.custom')}>
      {open && <CustomBrushForm initial={initial} onPick={onPick} />}
    </Dialog>
  )
}

function CustomBrushForm({ initial, onPick }: { initial: { start: string; end: string }; onPick: (s: string, e: string) => void }) {
  const { t } = useTranslation()
  const [start, setStart] = useState(initial.start)
  const [end, setEnd] = useState(initial.end)
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('shifts.start')}>{(p) => <Input {...p} type="time" value={start} onChange={(e) => setStart(e.target.value)} />}</Field>
        <Field label={t('shifts.end')} hint={isOvernight(start, end) && start !== end ? t('shifts.overnight') : undefined}>
          {(p) => <Input {...p} type="time" value={end} onChange={(e) => setEnd(e.target.value)} />}
        </Field>
      </div>
      <div className="flex justify-end">
        <Button onClick={() => onPick(start, end)} disabled={!start || !end || start === end}>
          {t('shifts.apply')}
        </Button>
      </div>
    </div>
  )
}
