import { AnimatePresence, motion } from 'motion/react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Badge } from '../../components/ui/Badge'
import { Button, IconButton } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Field'
import { Dialog } from '../../components/ui/Overlay'
import { Spinner } from '../../components/ui/Spinner'
import { errorMessage } from '../../lib/api'
import { addDays, formatDay, hhmm, isOvernight } from '../../lib/dates'
import type { AttendanceAction } from '../attendance/api'
import { actionIcons } from '../attendance/TodayPage'
import { useCorrections, useDayEvents, type EventDetail } from './api'

const types: AttendanceAction[] = ['CheckIn', 'BreakStart', 'BreakEnd', 'CheckOut']

export interface DayEditorTarget {
  userId: string
  name: string
  date: string
  plan: { startTime: string; endTime: string } | null
}

/** Bir kişinin bir günlük kayıtlarını düzeltme penceresi (yönetici). */
export function DayEditor({ target, onClose }: { target: DayEditorTarget | null; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <Dialog
      open={!!target}
      onClose={onClose}
      maxWidth="max-w-xl"
      title={target ? t('corrections.title', { name: target.name, date: formatDay(target.date, { weekday: 'long', day: 'numeric', month: 'long' }) }) : ''}
    >
      {target && <Editor key={target.userId + target.date} target={target} />}
    </Dialog>
  )
}


function Editor({ target }: { target: DayEditorTarget }) {
  const { t } = useTranslation()
  const events = useDayEvents(target.userId, target.date)
  const { add, change, remove } = useCorrections(target.userId, target.date)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState(false)
  const [editing, setEditing] = useState<{ id: string; date: string; time: string } | null>(null)

  // Yeni kayıt formu
  const [newType, setNewType] = useState<AttendanceAction>('CheckOut')
  const [newDate, setNewDate] = useState(target.date)
  const [newTime, setNewTime] = useState(target.plan ? hhmm(target.plan.endTime) : '18:00')

  function requireReason() {
    if (reason.trim().length >= 3) return true
    setReasonError(true)
    toast.error(t('corrections.reasonRequired'))
    return false
  }

  async function run(fn: () => Promise<unknown>, success: string) {
    try {
      await fn()
      toast.success(success)
      setEditing(null)
    } catch (err) {
      toast.error(errorMessage(err, t))
    }
  }

  const saveEdit = () =>
    editing && requireReason() &&
    run(() => change.mutateAsync({ id: editing.id, date: editing.date, time: editing.time, reason: reason.trim() }), t('corrections.saved'))

  const del = (e: EventDetail) =>
    requireReason() && run(() => remove.mutateAsync({ id: e.id, reason: reason.trim() }), t('corrections.deleted'))

  const addNew = (type = newType, date = newDate, time = newTime) =>
    requireReason() && run(() => add.mutateAsync({ type, date, time, reason: reason.trim() }), t('corrections.added'))

  const list = events.data ?? []
  const lastType = list.at(-1)?.type
  const openSession = lastType && lastType !== 'CheckOut'
  // Gece vardiyasında çıkış ertesi güne düşer
  const shiftEndDate = target.plan && isOvernight(target.plan.startTime, target.plan.endTime) ? addDays(target.date, 1) : target.date

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-soft">{t('corrections.subtitle')}</p>

      {/* Gerekçe: tüm işlemler için ortak, zorunlu */}
      <Field label={t('corrections.reason')} error={reasonError && reason.trim().length < 3 ? t('corrections.reasonRequired') : null}>
        {(p) => (
          <textarea
            {...p}
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              setReasonError(false)
            }}
            placeholder={t('corrections.reasonPlaceholder')}
            className="w-full resize-none rounded-xl border border-line bg-panel px-3.5 py-2.5 text-ink placeholder:text-ink-soft/60 focus:border-signal focus:ring-4 focus:ring-signal/15 focus:outline-none aria-invalid:border-overrun"
          />
        )}
      </Field>

      {/* Kayıtlar */}
      {events.isPending ? (
        <div className="grid place-items-center py-8 text-ink-soft">
          <Spinner />
        </div>
      ) : list.length === 0 ? (
        <p className="rounded-xl bg-panel-2 px-4 py-3 text-sm text-ink-soft ring-1 ring-line">{t('corrections.empty')}</p>
      ) : (
        <ol className="space-y-2">
          <AnimatePresence initial={false}>
            {list.map((e) => {
              const isEditing = editing?.id === e.id
              return (
                <motion.li
                  key={e.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-wrap items-center gap-3 rounded-xl bg-panel-2/60 px-3 py-2.5 ring-1 ring-line"
                >
                  <span className="grid size-8 place-items-center rounded-full bg-panel ring-1 ring-line [&_svg]:size-4">{actionIcons[e.type]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{t(`attendance.eventNames.${e.type}`)}</p>
                    {e.source === 'Manual' && (
                      <p className="truncate text-xs text-ink-soft" title={e.note ?? undefined}>
                        {t('corrections.manual')}
                        {e.recordedBy && ` · ${e.recordedBy}`}
                        {e.note && ` · ${e.note}`}
                      </p>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <Input type="date" value={editing.date} onChange={(ev) => setEditing({ ...editing, date: ev.target.value })} className="w-36 py-1.5" />
                      <Input type="time" value={editing.time} onChange={(ev) => setEditing({ ...editing, time: ev.target.value })} className="w-28 py-1.5" />
                      <IconButton label={t('common.save')} onClick={saveEdit} className="text-signal">
                        {change.isPending ? <Spinner className="size-4" /> : <Check className="size-5" />}
                      </IconButton>
                      <IconButton label={t('common.cancel')} onClick={() => setEditing(null)}>
                        <X className="size-5" />
                      </IconButton>
                    </div>
                  ) : (
                    <>
                      <span className="tabular text-sm font-semibold">
                        {e.localTime}
                        {e.localDate !== target.date && (
                          <span className="ml-1 text-xs font-normal text-ink-soft">({formatDay(e.localDate, { day: 'numeric', month: 'short' })})</span>
                        )}
                      </span>
                      {e.source === 'Manual' && <Badge tone="pause">{t('corrections.manual')}</Badge>}
                      <IconButton
                        label={t('corrections.editTime')}
                        onClick={() => setEditing({ id: e.id, date: e.localDate, time: e.localTime })}
                      >
                        <Pencil className="size-4" />
                      </IconButton>
                      <IconButton label={t('corrections.delete')} onClick={() => del(e)} className="hover:text-overrun">
                        <Trash2 className="size-4" />
                      </IconButton>
                    </>
                  )}
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ol>
      )}

      {/* Hızlı çözüm: açık kalan oturumu vardiya bitişiyle kapat */}
      {openSession && target.plan && (
        <Button variant="secondary" size="sm" onClick={() => addNew('CheckOut', shiftEndDate, hhmm(target.plan!.endTime))} loading={add.isPending}>
          <Plus className="size-4" />
          {t('corrections.quickCheckout')} ({hhmm(target.plan.endTime)})
        </Button>
      )}

      {/* Yeni kayıt */}
      <section className="rounded-2xl bg-panel-2/60 p-4 ring-1 ring-line">
        <h3 className="text-sm font-medium">{t('corrections.add')}</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label={t('corrections.type')}>
            {(p) => (
              <Select {...p} value={newType} onChange={(e) => setNewType(e.target.value as AttendanceAction)}>
                {types.map((ty) => (
                  <option key={ty} value={ty}>
                    {t(`attendance.eventNames.${ty}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('corrections.date')}>{(p) => <Input {...p} type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />}</Field>
          <Field label={t('corrections.time')}>{(p) => <Input {...p} type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />}</Field>
        </div>
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={() => addNew()} loading={add.isPending} disabled={!newTime || !newDate}>
            <Plus className="size-4" />
            {t('corrections.add')}
          </Button>
        </div>
      </section>

    </div>
  )
}
