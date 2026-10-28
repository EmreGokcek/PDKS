import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { Sheet } from '../../components/ui/Overlay'
import { errorMessage } from '../../lib/api'
import { todayIso } from '../../lib/dates'
import { useSaveAnnouncement, type Announcement } from './api'

/** Duyuru yazma / düzenleme paneli. editing=null ise yeni duyuru. */
export function AnnouncementSheet({
  open,
  editing,
  companyWide,
  onClose,
}: {
  open: boolean
  editing: Announcement | null
  /** Yayınlayan yöneticiyse duyuru tüm firmaya gider; müdürse yalnızca şubesine. */
  companyWide: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <Sheet
      open={open}
      onClose={onClose}
      closeLabel={t('common.close')}
      title={editing ? t('announcements.edit') : t('announcements.create')}
      description={companyWide ? t('announcements.audienceCompany') : t('announcements.audienceBranch')}
    >
      {open && <Form key={editing?.id ?? 'new'} editing={editing} onDone={onClose} />}
    </Sheet>
  )
}

function Form({ editing, onDone }: { editing: Announcement | null; onDone: () => void }) {
  const { t } = useTranslation()
  const save = useSaveAnnouncement()
  const [title, setTitle] = useState(editing?.title ?? '')
  const [body, setBody] = useState(editing?.body ?? '')
  const [isPinned, setPinned] = useState(editing?.isPinned ?? false)
  const [showOnKiosk, setShowOnKiosk] = useState(editing?.showOnKiosk ?? true)
  const [expiresOn, setExpiresOn] = useState(editing?.expiresOn ?? '')

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      await save.mutateAsync({
        id: editing?.id,
        input: { title: title.trim(), body: body.trim() || null, isPinned, showOnKiosk, expiresOn: expiresOn || null },
      })
      toast.success(editing ? t('announcements.updated') : t('announcements.saved'))
      onDone()
    } catch (err) {
      toast.error(errorMessage(err, t))
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label={t('announcements.fields.title')}>
        {(f) => <Input {...f} required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />}
      </Field>
      <Field label={t('announcements.fields.body')} optional={t('common.optional')} hint={`${body.length}/1000`}>
        {(f) => (
          <textarea
            {...f}
            rows={5}
            maxLength={1000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full resize-y rounded-xl border border-line bg-panel px-3.5 py-2.5 text-ink placeholder:text-ink-soft/60 focus:border-signal focus:ring-4 focus:ring-signal/15 focus:outline-none"
          />
        )}
      </Field>
      <Field label={t('announcements.fields.expiresOn')} optional={t('common.optional')} hint={t('announcements.expiresHint')}>
        {(f) => <Input {...f} type="date" min={todayIso()} value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />}
      </Field>

      <div className="space-y-3">
        <Check checked={isPinned} onChange={setPinned} label={t('announcements.fields.isPinned')} hint={t('announcements.pinnedHint')} />
        <Check checked={showOnKiosk} onChange={setShowOnKiosk} label={t('announcements.fields.showOnKiosk')} hint={t('announcements.kioskHint')} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={save.isPending} disabled={!title.trim()}>
          {editing ? t('common.save') : t('announcements.publish')}
        </Button>
      </div>
    </form>
  )
}

function Check({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ring-line hover:bg-panel-2">
      <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--color-signal)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-sm">
        <span className="font-medium">{label}</span>
        <span className="block text-ink-soft">{hint}</span>
      </span>
    </label>
  )
}
