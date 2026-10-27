import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { Dialog } from '../../components/ui/Overlay'
import { hhmm, isOvernight, shiftMinutes } from '../../lib/dates'
import { formatDuration, formatMinutes } from '../../lib/format'
import type { Shift, ShiftTemplate } from './api'
import { isLeave, leaveColors, leaveKinds, netWorkMinutes, type LeaveKind } from './leave'
import { LeaveChip, ShiftChip } from './ShiftChip'

export interface CellTarget {
  userId: string
  name: string
  date: string
  dateLabel: string
  shift: Shift | undefined
}

/** Tek bir hücreyi düzenleme: şablon seç, özel saat gir ya da kaldır. */
export function CellDialog({
  target,
  templates,
  dailyBreak,
  onLeave,
  onTemplate,
  onCustom,
  onRemove,
  onClose,
}: {
  target: CellTarget | null
  templates: ShiftTemplate[]
  dailyBreak: number
  onLeave: (kind: LeaveKind) => void
  onTemplate: (templateId: string) => void
  onCustom: (start: string, end: string, note: string) => void
  onRemove: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog
      open={!!target}
      onClose={onClose}
      title={target ? t('shifts.cellTitle', { name: target.name, date: target.dateLabel }) : ''}
      maxWidth="max-w-lg"
    >
      {target && (
        <CellForm
          key={target.userId + target.date}
          target={target}
          templates={templates}
          dailyBreak={dailyBreak}
          onLeave={onLeave}
          onTemplate={onTemplate}
          onCustom={onCustom}
          onRemove={onRemove}
        />
      )}
    </Dialog>
  )
}

function CellForm({
  target,
  templates,
  dailyBreak,
  onLeave,
  onTemplate,
  onCustom,
  onRemove,
}: {
  target: CellTarget
  templates: ShiftTemplate[]
  dailyBreak: number
  onLeave: (kind: LeaveKind) => void
  onTemplate: (templateId: string) => void
  onCustom: (start: string, end: string, note: string) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const work = target.shift && !isLeave(target.shift.kind) ? target.shift : undefined
  const [start, setStart] = useState(work ? hhmm(work.startTime) : '09:00')
  const [end, setEnd] = useState(work ? hhmm(work.endTime) : '18:00')
  const gross = start && end && start !== end ? shiftMinutes(start, end) : 0
  const [note, setNote] = useState(target.shift?.note ?? '')

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-medium text-ink-soft">{t('shifts.useTemplate')}</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onTemplate(tpl.id)}
              className={`h-14 rounded-xl ring-2 transition-[box-shadow] ${work?.templateId === tpl.id ? 'ring-signal' : 'ring-transparent hover:ring-line'}`}
            >
              <ShiftChip start={tpl.startTime} end={tpl.endTime} name={tpl.name} color={tpl.color} />
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium text-ink-soft">{t('shifts.customTimes')}</h3>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <Field label={t('shifts.start')}>{(p) => <Input {...p} type="time" value={start} onChange={(e) => setStart(e.target.value)} />}</Field>
          <Field label={t('shifts.end')} hint={start && end && isOvernight(start, end) && start !== end ? t('shifts.overnight') : undefined}>
            {(p) => <Input {...p} type="time" value={end} onChange={(e) => setEnd(e.target.value)} />}
          </Field>
        </div>
        {gross > 0 && (
          <p className="mt-2 text-sm text-ink-soft">
            {t('shifts.workAndBreak', {
              work: formatDuration(netWorkMinutes(gross, dailyBreak)),
              break: formatMinutes(gross > dailyBreak ? dailyBreak : 0),
            })}
          </p>
        )}
        <div className="mt-3">
          <Field label={t('shifts.note')} optional={t('common.optional')}>
            {(p) => <Input {...p} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />}
          </Field>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium text-ink-soft">{t('shifts.leave')}</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {leaveKinds.map((lk) => (
            <button
              key={lk}
              type="button"
              onClick={() => onLeave(lk)}
              className={`h-11 rounded-xl ring-2 transition-[box-shadow] ${target.shift?.kind === lk ? 'ring-signal' : 'ring-transparent hover:ring-line'}`}
            >
              <LeaveChip label={t(`shifts.kinds.${lk}`)} color={leaveColors[lk]} />
            </button>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        {target.shift ? (
          <Button variant="ghost" className="text-overrun hover:text-overrun" onClick={onRemove}>
            <Trash2 className="size-4" />
            {t('shifts.remove')}
          </Button>
        ) : (
          <span />
        )}
        <Button onClick={() => onCustom(start, end, note)} disabled={!start || !end || start === end}>
          {t('shifts.apply')}
        </Button>
      </div>
    </div>
  )
}
