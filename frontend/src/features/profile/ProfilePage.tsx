import { motion } from 'motion/react'
import { KeyRound, Pencil } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { PageHeader } from '../../components/AppShell'
import { LanguageMenu, ThemeSwitch } from '../../components/PreferencesControls'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Field'
import { Sheet } from '../../components/ui/Overlay'
import { Spinner } from '../../components/ui/Spinner'
import { errorMessage } from '../../lib/api'
import { todayIso } from '../../lib/dates'
import { bloodLabel, bloodTypes, completeness, useMyProfile, useUpdateProfile, type Profile, type ProfileInput } from './api'
import { ProfileHeader, ProfileSections } from './ProfileView'

export function ProfilePage() {
  const { t } = useTranslation()
  const profile = useMyProfile()
  const [editing, setEditing] = useState(false)

  if (profile.isPending || !profile.data) {
    return (
      <>
        <PageHeader title={t('profile.title')} />
        <div className="grid place-items-center py-24 text-ink-soft">
          <Spinner />
        </div>
      </>
    )
  }

  const p = profile.data
  const percent = completeness(p)

  return (
    <>
      <PageHeader title={t('profile.title')} />

      <ProfileHeader
        profile={p}
        actions={
          <Button onClick={() => setEditing(true)} className="bg-on-brand text-brand hover:brightness-95">
            <Pencil className="size-4" />
            {t('profile.edit')}
          </Button>
        }
      />

      {percent < 100 && (
        <motion.button
          type="button"
          onClick={() => setEditing(true)}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex w-full items-center gap-4 rounded-2xl bg-pause-soft px-5 py-4 text-left ring-1 ring-pause/20"
        >
          <div className="flex-1">
            <p className="font-medium text-pause">{t('profile.completeness', { percent })}</p>
            <p className="text-sm text-ink-soft">{t('profile.completenessHint')}</p>
          </div>
          <div className="h-2 w-32 overflow-hidden rounded-full bg-panel">
            <motion.div className="h-full rounded-full bg-pause" initial={{ width: 0 }} animate={{ width: `${percent}%` }} transition={{ duration: 0.8 }} />
          </div>
        </motion.button>
      )}

      <div className="mt-4">
        <ProfileSections profile={p} showLocks />
      </div>

      <section className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl bg-panel p-5 ring-1 ring-line">
        <h3 className="mr-auto font-semibold">{t('profile.sections.account')}</h3>
        <ThemeSwitch />
        <LanguageMenu />
        <Link
          to="/sifre-degistir"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-panel px-4 font-medium transition-colors hover:bg-panel-2"
        >
          <KeyRound className="size-4" />
          {t('profile.changePassword')}
        </Link>
      </section>

      <Sheet open={editing} onClose={() => setEditing(false)} closeLabel={t('common.close')} title={t('profile.editTitle')}>
        {editing && <EditForm profile={p} onDone={() => setEditing(false)} />}
      </Sheet>
    </>
  )
}

function EditForm({ profile: p, onDone }: { profile: Profile; onDone: () => void }) {
  const { t } = useTranslation()
  const update = useUpdateProfile()
  const [v, setV] = useState<ProfileInput>({
    phone: p.phone ?? '',
    address: p.address ?? '',
    birthDate: p.birthDate ?? '',
    bloodType: p.bloodType ?? '',
    healthDataConsent: !!p.healthDataConsentAt,
    emergencyContactName: p.emergencyContactName ?? '',
    emergencyContactPhone: p.emergencyContactPhone ?? '',
    emergencyContactRelation: p.emergencyContactRelation ?? '',
  })
  const set = <K extends keyof ProfileInput>(k: K, value: ProfileInput[K]) => setV((x) => ({ ...x, [k]: value }))
  const needsConsent = !!v.bloodType && !p.healthDataConsentAt

  async function submit(e: FormEvent) {
    e.preventDefault()
    const n = (s: string | null) => (s && s.trim() ? s.trim() : null)
    try {
      await update.mutateAsync({
        phone: n(v.phone),
        address: n(v.address),
        birthDate: n(v.birthDate),
        bloodType: n(v.bloodType),
        healthDataConsent: v.healthDataConsent,
        emergencyContactName: n(v.emergencyContactName),
        emergencyContactPhone: n(v.emergencyContactPhone),
        emergencyContactRelation: n(v.emergencyContactRelation),
      })
      toast.success(t('profile.saved'))
      onDone()
    } catch (err) {
      toast.error(errorMessage(err, t))
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset className="space-y-4">
        <legend className="mb-3 text-sm font-semibold">{t('profile.sections.contact')}</legend>
        <Field label={t('profile.fields.phone')}>{(f) => <Input {...f} type="tel" value={v.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />}</Field>
        <Field label={t('profile.fields.address')}>
          {(f) => (
            <textarea
              {...f}
              rows={2}
              maxLength={300}
              value={v.address ?? ''}
              onChange={(e) => set('address', e.target.value)}
              className="w-full resize-none rounded-xl border border-line bg-panel px-3.5 py-2.5 text-ink focus:border-signal focus:ring-4 focus:ring-signal/15 focus:outline-none"
            />
          )}
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-3 text-sm font-semibold">{t('profile.sections.personal')}</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('profile.fields.birthDate')}>
            {(f) => <Input {...f} type="date" max={todayIso()} value={v.birthDate ?? ''} onChange={(e) => set('birthDate', e.target.value)} />}
          </Field>
          <Field label={t('profile.fields.bloodType')}>
            {(f) => (
              <Select {...f} value={v.bloodType ?? ''} onChange={(e) => set('bloodType', e.target.value)}>
                <option value="">{t('profile.noBloodType')}</option>
                {bloodTypes.map((b) => (
                  <option key={b} value={b}>
                    {bloodLabel(b)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        {needsConsent && (
          <motion.label
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex items-start gap-3 rounded-xl bg-pause-soft p-3.5 text-sm"
          >
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-[var(--color-signal)]"
              checked={v.healthDataConsent}
              onChange={(e) => set('healthDataConsent', e.target.checked)}
            />
            {t('profile.consent')}
          </motion.label>
        )}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-3 text-sm font-semibold">{t('profile.sections.emergency')}</legend>
        <Field label={t('profile.fields.emergencyName')}>
          {(f) => <Input {...f} value={v.emergencyContactName ?? ''} onChange={(e) => set('emergencyContactName', e.target.value)} />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('profile.fields.emergencyPhone')}>
            {(f) => <Input {...f} type="tel" value={v.emergencyContactPhone ?? ''} onChange={(e) => set('emergencyContactPhone', e.target.value)} />}
          </Field>
          <Field label={t('profile.fields.emergencyRelation')}>
            {(f) => (
              <Input
                {...f}
                value={v.emergencyContactRelation ?? ''}
                placeholder={t('profile.relationPlaceholder')}
                onChange={(e) => set('emergencyContactRelation', e.target.value)}
              />
            )}
          </Field>
        </div>
      </fieldset>

      <p className="text-xs text-ink-soft">{t('profile.adminOnly')}</p>

      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={onDone} disabled={update.isPending}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={update.isPending} disabled={needsConsent && !v.healthDataConsent}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  )
}
