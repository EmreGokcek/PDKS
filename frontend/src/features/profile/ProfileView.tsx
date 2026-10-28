import { Briefcase, HeartPulse, Lock, Phone, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { locale } from '../../i18n'
import { formatDay, parseDate } from '../../lib/dates'
import { bloodLabel, type Profile } from './api'

/** Profilin okunur görünümü. Hem "Profilim" sayfasında hem yöneticinin personel görünümünde kullanılır. */
export function ProfileSections({ profile: p, showLocks = false, single = false }: { profile: Profile; showLocks?: boolean; single?: boolean }) {
  const { t } = useTranslation()
  const date = (iso: string | null) => (iso ? formatDay(iso, { day: 'numeric', month: 'long', year: 'numeric' }) : null)

  return (
    <div className={`grid gap-4 ${single ? '' : 'md:grid-cols-2'}`}>
      <Section icon={<Phone className="size-4" />} title={t('profile.sections.contact')}>
        <Row label={t('profile.fields.email')} value={p.email} locked={showLocks} />
        <Row label={t('profile.fields.phone')} value={p.phone} />
        <Row label={t('profile.fields.address')} value={p.address} />
      </Section>

      <Section icon={<UserRound className="size-4" />} title={t('profile.sections.personal')}>
        <Row label={t('profile.fields.birthDate')} value={date(p.birthDate)} />
        <Row
          label={t('profile.fields.bloodType')}
          value={
            p.bloodType && (
              <span className="inline-flex items-center gap-2">
                <Badge tone="overrun">{bloodLabel(p.bloodType)}</Badge>
              </span>
            )
          }
          hint={p.healthDataConsentAt ? t('profile.consentGiven', { date: date(p.healthDataConsentAt.slice(0, 10)) }) : undefined}
        />
      </Section>

      <Section icon={<HeartPulse className="size-4" />} title={t('profile.sections.emergency')}>
        <Row label={t('profile.fields.emergencyName')} value={p.emergencyContactName} />
        <Row label={t('profile.fields.emergencyPhone')} value={p.emergencyContactPhone} />
        <Row label={t('profile.fields.emergencyRelation')} value={p.emergencyContactRelation} />
      </Section>

      <Section icon={<Briefcase className="size-4" />} title={t('profile.sections.work')} note={showLocks ? t('profile.adminOnly') : undefined}>
        <Row label={t('profile.fields.position')} value={p.position} locked={showLocks} />
        <Row label={t('profile.fields.branch')} value={p.branchName} locked={showLocks} />
        <Row label={t('profile.fields.employeeNumber')} value={p.employeeNumber} locked={showLocks} />
        <Row label={t('profile.fields.hireDate')} value={date(p.hireDate)} hint={p.hireDate && tenure(p.hireDate) ? t('profile.tenure', { time: tenure(p.hireDate) }) : undefined} locked={showLocks} />
      </Section>
    </div>
  )
}

/** Profil başlığı: büyük baş harfler, ad, pozisyon ve rol. */
export function ProfileHeader({ profile: p, actions }: { profile: Profile; actions?: ReactNode }) {
  const { t } = useTranslation()
  return (
    <section className="relative overflow-hidden rounded-3xl bg-brand p-6 text-on-brand sm:p-8 dark:ring-1 dark:ring-line">
      <div className="flex flex-wrap items-center gap-5">
        <div className="scale-150 p-2">
          <Avatar name={p.fullName} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-semibold tracking-tight">{p.fullName}</h2>
          <p className="mt-1 text-on-brand/70">
            {[p.position, p.branchName, p.companyName].filter(Boolean).join(' · ')}
          </p>
          <span className="mt-3 inline-flex rounded-full bg-on-brand/10 px-3 py-1 text-sm ring-1 ring-on-brand/20">{t(`roles.${p.role}`)}</span>
        </div>
        {actions}
      </div>
    </section>
  )
}

/** İşe girişten bu yana geçen süre: "2 yıl 3 ay". */
function tenure(hireDate: string) {
  const start = parseDate(hireDate)
  const now = new Date()
  let months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth()
  if (now.getDate() < start.getDate()) months--
  if (months < 1) return undefined
  const fmt = (n: number, unit: 'year' | 'month') => new Intl.NumberFormat(locale(), { style: 'unit', unit, unitDisplay: 'long' }).format(n)
  const y = Math.floor(months / 12)
  const m = months % 12
  return [y ? fmt(y, 'year') : '', m ? fmt(m, 'month') : ''].filter(Boolean).join(' ')
}

function Section({ icon, title, note, children }: { icon: ReactNode; title: string; note?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-panel p-5 ring-1 ring-line">
      <h3 className="flex items-center gap-2 font-semibold">
        <span className="grid size-8 place-items-center rounded-lg bg-signal-soft text-signal">{icon}</span>
        {title}
      </h3>
      <dl className="mt-4 space-y-3">{children}</dl>
      {note && <p className="mt-4 text-xs text-ink-soft">{note}</p>}
    </section>
  )
}

function Row({ label, value, hint, locked }: { label: string; value: ReactNode; hint?: string; locked?: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-3 text-sm">
      <dt className="flex items-center gap-1.5 text-ink-soft">
        {label}
        {locked && <Lock className="size-3 opacity-60" />}
      </dt>
      <dd className="min-w-0">
        {value ? <span className="break-words">{value}</span> : <span className="text-ink-soft/60">{t('profile.empty')}</span>}
        {hint && <span className="block text-xs text-ink-soft">{hint}</span>}
      </dd>
    </div>
  )
}
