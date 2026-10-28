import { AnimatePresence, motion } from 'motion/react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button, IconButton } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { Sheet } from '../../components/ui/Overlay'
import { errorMessage } from '../../lib/api'
import { hhmm, isOvernight, toApiTime } from '../../lib/dates'
import { useDeleteTemplate, useSaveTemplate, type ShiftTemplate } from './api'
import { ShiftChip, templateColors } from './ShiftChip'

/** Vardiya şablonlarını yönetme paneli. */
export function TemplatesSheet({ open, templates, onClose }: { open: boolean; templates: ShiftTemplate[]; onClose: () => void }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState<ShiftTemplate | 'new' | null>(null)
  const remove = useDeleteTemplate()

  return (
    <Sheet open={open} onClose={onClose} closeLabel={t('common.close')} title={t('shifts.templates')} description={t('shifts.templatesHint')}>
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {templates.map((tpl) => (
            <motion.li key={tpl.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}>
              {editing !== 'new' && editing?.id === tpl.id ? (
                <TemplateForm template={tpl} onDone={() => setEditing(null)} />
              ) : (
                <div className="flex items-center gap-2">
                  <div className="h-12 flex-1">
                    <ShiftChip start={tpl.startTime} end={tpl.endTime} name={tpl.name} color={tpl.color} />
                  </div>
                  <IconButton label={t('common.edit')} onClick={() => setEditing(tpl)}>
                    <Pencil className="size-4" />
                  </IconButton>
                  <IconButton
                    label={t('shifts.erase')}
                    onClick={async () => {
                      try {
                        await remove.mutateAsync(tpl.id)
                        toast.success(t('shifts.templateDeleted'))
                      } catch (err) {
                        toast.error(errorMessage(err, t))
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {templates.length === 0 && editing !== 'new' && <p className="text-sm text-ink-soft">{t('shifts.templatesEmpty')}</p>}

      <div className="mt-5">
        {editing === 'new' ? (
          <TemplateForm onDone={() => setEditing(null)} />
        ) : (
          <Button variant="secondary" onClick={() => setEditing('new')}>
            <Plus className="size-4" />
            {t('shifts.templateNew')}
          </Button>
        )}
      </div>
    </Sheet>
  )
}

function TemplateForm({ template, onDone }: { template?: ShiftTemplate; onDone: () => void }) {
  const { t } = useTranslation()
  const save = useSaveTemplate()
  const [name, setName] = useState(template?.name ?? '')
  const [start, setStart] = useState(template ? hhmm(template.startTime) : '09:00')
  const [end, setEnd] = useState(template ? hhmm(template.endTime) : '18:00')
  const [color, setColor] = useState(template?.color ?? templateColors[0]!)

  async function submit() {
    try {
      await save.mutateAsync({ id: template?.id, name: name.trim(), startTime: toApiTime(start), endTime: toApiTime(end), color })
      toast.success(t('shifts.templateSaved'))
      onDone()
    } catch (err) {
      toast.error(errorMessage(err, t))
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 rounded-2xl bg-panel-2 p-4 ring-1 ring-line"
    >
      <Field label={t('shifts.templateName')}>{(p) => <Input {...p} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('shifts.start')}>{(p) => <Input {...p} type="time" value={start} onChange={(e) => setStart(e.target.value)} />}</Field>
        <Field label={t('shifts.end')} hint={isOvernight(start, end) && start !== end ? t('shifts.overnight') : undefined}>
          {(p) => <Input {...p} type="time" value={end} onChange={(e) => setEnd(e.target.value)} />}
        </Field>
      </div>
      <fieldset>
        <legend className="text-sm font-medium">{t('shifts.templateColor')}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {templateColors.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              className={`size-8 rounded-full ring-offset-2 ring-offset-panel-2 transition-[box-shadow] ${color === c ? 'ring-2 ring-ink' : ''}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button size="sm" onClick={submit} loading={save.isPending} disabled={!name.trim() || start === end}>
          {template ? t('common.save') : t('shifts.templateAdd')}
        </Button>
      </div>
    </motion.div>
  )
}
