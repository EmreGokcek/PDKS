import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { Dialog } from '../../components/ui/Overlay'
import { hhmm, isOvernight } from '../../lib/dates'
import type { Shift, ShiftTemplate } from './api'
import { ShiftChip } from './ShiftChip'

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
  onTemplate,
  onCustom,
  onRemove,
  onClose,
}: {
  target: CellTarget | null
  templates: ShiftTemplate[]
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
        <CellForm key={target.userId + target.date} target={target} templates={templates} onTemplate={onTemplate} onCustom={onCustom} onRemove={onRemove} />
      )}
    </Dialog>
  )
}

function CellForm({
  target,
  templates,
  onTemplate,
  onCustom,
  onRemove,
}: {
  target: CellTarget
  templates: ShiftTemplate[]
  onTemplate: (templateId: string) => void
  onCustom: (start: string, end: string, note: string) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const [start, setStart] = useState(target.shift ? hhmm(target.shift.startTime) : '09:00')
  const [end, setEnd] = useState(target.shift ? hhmm(target.shift.endTime) : '18:00')
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
              className={`h-14 rounded-xl ring-2 transition-[box-shadow] ${target.shift?.templateId === tpl.id ? 'ring-signal' : 'ring-transparent hover:ring-line'}`}
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
        <div className="mt-3">
          <Field label={t('shifts.note')} optional={t('common.optional')}>
            {(p) => <Input {...p} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />}
          </Field>
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
