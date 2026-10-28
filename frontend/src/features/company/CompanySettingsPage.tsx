import { Building2, KeyRound, MapPin, MonitorSmartphone, MoreHorizontal, Pencil, Plus, Power, PowerOff, Users } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { PageHeader } from '../../components/AppShell'
import { Badge } from '../../components/ui/Badge'
import { Button, IconButton } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Field'
import { Menu, type MenuItem } from '../../components/ui/Menu'
import { Dialog, Sheet } from '../../components/ui/Overlay'
import { PageSkeleton } from '../../components/ui/Skeleton'
import { errorMessage } from '../../lib/api'
import { relativeTime } from '../../lib/format'
import { ConfirmDialog, CopyRow } from '../users/Dialogs'
import {
  useCompany,
  useCreateKiosk,
  useRenameCompany,
  useResetKiosk,
  useSaveBranch,
  useToggleKiosk,
  useUpdateKiosk,
  type BranchSettings,
  type KioskInfo,
  type KioskWithPassword,
} from './api'

/** Sık kullanılan saat dilimleri; şubenin mevcut dilimi listede yoksa o da eklenir. */
const TIME_ZONES = ['Europe/Istanbul', 'Europe/London', 'Europe/Berlin', 'Europe/Amsterdam', 'Europe/Moscow', 'Asia/Baku', 'Asia/Dubai', 'Asia/Almaty', 'America/New_York']

/** Firma ayarları: firma adı, şubeler ve giriş kioskları (yalnızca yönetici). */
export function CompanySettingsPage() {
  const { t } = useTranslation()
  const query = useCompany()
  const [branchSheet, setBranchSheet] = useState<BranchSettings | 'new' | null>(null)
  const [kioskSheet, setKioskSheet] = useState<KioskInfo | 'new' | null>(null)
  const [credentials, setCredentials] = useState<{ result: KioskWithPassword; mode: 'created' | 'reset' } | null>(null)
  const [confirm, setConfirm] = useState<{ kind: 'reset' | 'deactivate'; kiosk: KioskInfo } | null>(null)
  const reset = useResetKiosk()
  const toggle = useToggleKiosk()

  if (query.isPending || !query.data) {
    return (
      <>
        <PageHeader title={t('company.title')} subtitle={t('company.subtitle')} />
        {query.isError ? <p className="text-ink-soft">{errorMessage(query.error, t)}</p> : <PageSkeleton variant="grid" />}
      </>
    )
  }

  const data = query.data
  const activeBranches = data.branches.filter((b) => b.isActive)

  async function runConfirm() {
    if (!confirm) return
    try {
      if (confirm.kind === 'reset') {
        const result = await reset.mutateAsync(confirm.kiosk.id)
        setCredentials({ result, mode: 'reset' })
      } else {
        await toggle.mutateAsync({ id: confirm.kiosk.id, active: false })
        toast.success(t('company.kiosks.deactivated', { name: confirm.kiosk.name }))
      }
      setConfirm(null)
    } catch (err) {
      toast.error(errorMessage(err, t))
    }
  }

  async function activate(kiosk: KioskInfo) {
    try {
      await toggle.mutateAsync({ id: kiosk.id, active: true })
      toast.success(t('company.kiosks.activated', { name: kiosk.name }))
    } catch (err) {
      toast.error(errorMessage(err, t))
    }
  }

  return (
    <>
      <PageHeader title={t('company.title')} subtitle={t('company.subtitle')} />

      <div className="space-y-6">
        <CompanyNameCard key={data.name} name={data.name} />

        <Card
          icon={<MapPin className="size-5" />}
          title={t('company.branches.title')}
          hint={t('company.branches.hint')}
          action={
            <Button size="sm" variant="secondary" onClick={() => setBranchSheet('new')}>
              <Plus className="size-4" />
              {t('company.branches.add')}
            </Button>
          }
        >
          <ul className="divide-y divide-line">
            {data.branches.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className={`font-medium ${b.isActive ? '' : 'text-ink-soft line-through decoration-ink-soft/40'}`}>{b.name}</p>
                  <p className="text-sm text-ink-soft">{b.timeZone}</p>
                </div>
                <span className="flex items-center gap-1.5 text-sm text-ink-soft" title={t('company.branches.staff')}>
                  <Users className="size-4" />
                  <span className="tabular">{b.staffCount}</span>
                </span>
                <span className="flex items-center gap-1.5 text-sm text-ink-soft" title={t('company.branches.kiosks')}>
                  <MonitorSmartphone className="size-4" />
                  <span className="tabular">{b.kioskCount}</span>
                </span>
                {!b.isActive && <Badge tone="neutral">{t('company.closed')}</Badge>}
                <IconButton label={t('common.edit')} onClick={() => setBranchSheet(b)}>
                  <Pencil className="size-4" />
                </IconButton>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          icon={<MonitorSmartphone className="size-5" />}
          title={t('company.kiosks.title')}
          hint={t('company.kiosks.hint')}
          action={
            <Button size="sm" variant="secondary" onClick={() => setKioskSheet('new')} disabled={activeBranches.length === 0}>
              <Plus className="size-4" />
              {t('company.kiosks.add')}
            </Button>
          }
        >
          {data.kiosks.length === 0 ? (
            <div className="rounded-xl bg-panel-2 p-5 text-center ring-1 ring-line">
              <p className="font-medium">{t('company.kiosks.emptyTitle')}</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">{t('company.kiosks.empty')}</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {data.kiosks.map((k) => {
                const actions: MenuItem[] = [
                  { label: t('common.edit'), icon: <Pencil className="size-4" />, onSelect: () => setKioskSheet(k) },
                  { label: t('company.kiosks.resetPassword'), icon: <KeyRound className="size-4" />, onSelect: () => setConfirm({ kind: 'reset', kiosk: k }) },
                  k.isActive
                    ? { label: t('company.kiosks.deactivate'), icon: <PowerOff className="size-4" />, tone: 'danger', onSelect: () => setConfirm({ kind: 'deactivate', kiosk: k }) }
                    : { label: t('company.kiosks.activate'), icon: <Power className="size-4" />, onSelect: () => void activate(k) },
                ]
                return (
                  <li key={k.id} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                    <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${k.isActive ? 'bg-signal-soft text-signal' : 'bg-panel-2 text-ink-soft ring-1 ring-line'}`}>
                      <MonitorSmartphone className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {k.name}
                        {!k.isActive && <Badge tone="neutral">{t('company.closed')}</Badge>}
                      </p>
                      <p className="truncate text-sm text-ink-soft">
                        {k.branchName} · <span className="font-mono text-xs">{k.email}</span>
                      </p>
                    </div>
                    <span className="text-right text-sm text-ink-soft max-sm:hidden">
                      {k.lastSeenAt ? t('company.kiosks.lastSeen', { time: relativeTime(k.lastSeenAt) }) : t('company.kiosks.neverSeen')}
                    </span>
                    <Menu
                      items={actions}
                      trigger={(props) => (
                        <IconButton label={t('users.actions')} {...props}>
                          <MoreHorizontal className="size-5" />
                        </IconButton>
                      )}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      <BranchSheet target={branchSheet} onClose={() => setBranchSheet(null)} />
      <KioskSheet
        target={kioskSheet}
        branches={activeBranches}
        onClose={() => setKioskSheet(null)}
        onCreated={(result) => {
          setKioskSheet(null)
          setCredentials({ result, mode: 'created' })
        }}
      />
      <KioskCredentialsDialog value={credentials} onClose={() => setCredentials(null)} />
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.kind === 'reset' ? t('company.kiosks.resetTitle') : t('company.kiosks.deactivateTitle')}
        body={confirm ? t(confirm.kind === 'reset' ? 'company.kiosks.resetBody' : 'company.kiosks.deactivateBody', { name: confirm.kiosk.name }) : ''}
        confirmLabel={confirm?.kind === 'reset' ? t('company.kiosks.resetPassword') : t('company.kiosks.deactivate')}
        tone={confirm?.kind === 'deactivate' ? 'danger' : 'primary'}
        loading={reset.isPending || toggle.isPending}
        onConfirm={() => void runConfirm()}
        onClose={() => setConfirm(null)}
      />
    </>
  )
}

function Card({ icon, title, hint, action, children }: { icon: ReactNode; title: string; hint?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-panel p-5 ring-1 ring-line sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-signal-soft text-signal">{icon}</span>
          <h2 className="font-semibold">{title}</h2>
        </div>
        {action}
      </div>
      {hint && <p className="mt-3 max-w-2xl text-sm text-ink-soft">{hint}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

function CompanyNameCard({ name }: { name: string }) {
  const { t } = useTranslation()
  const [value, setValue] = useState(name)
  const rename = useRenameCompany()
  const dirty = value.trim() !== name && value.trim().length >= 2

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!dirty) return
    try {
      await rename.mutateAsync(value.trim())
      toast.success(t('company.nameSaved'))
    } catch (err) {
      toast.error(errorMessage(err, t))
    }
  }

  return (
    <Card icon={<Building2 className="size-5" />} title={t('company.nameTitle')} hint={t('company.nameHint')}>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <Field label={t('company.name')}>
            {(p) => <Input {...p} maxLength={200} value={value} onChange={(e) => setValue(e.target.value)} />}
          </Field>
        </div>
        <Button type="submit" disabled={!dirty} loading={rename.isPending}>
          {t('common.save')}
        </Button>
      </form>
    </Card>
  )
}

function BranchSheet({ target, onClose }: { target: BranchSettings | 'new' | null; onClose: () => void }) {
  const { t } = useTranslation()
  const branch = target === 'new' ? null : target
  return (
    <Sheet
      open={!!target}
      onClose={onClose}
      closeLabel={t('common.close')}
      title={branch ? t('company.branches.editTitle') : t('company.branches.add')}
      description={branch?.name}
    >
      {target && <BranchForm key={branch?.id ?? 'new'} branch={branch} onClose={onClose} />}
    </Sheet>
  )
}

function BranchForm({ branch, onClose }: { branch: BranchSettings | null; onClose: () => void }) {
  const { t } = useTranslation()
  const save = useSaveBranch()
  const [name, setName] = useState(branch?.name ?? '')
  const [timeZone, setTimeZone] = useState(branch?.timeZone ?? 'Europe/Istanbul')
  const [isActive, setActive] = useState(branch?.isActive ?? true)
  const [error, setError] = useState<string | null>(null)
  const zones = TIME_ZONES.includes(timeZone) ? TIME_ZONES : [timeZone, ...TIME_ZONES]

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (name.trim().length < 2) return setError(t('errors.required'))
    try {
      await save.mutateAsync({ id: branch?.id, name: name.trim(), timeZone, isActive })
      toast.success(t('company.branches.saved'))
      onClose()
    } catch (err) {
      toast.error(errorMessage(err, t))
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-full flex-col">
      <div className="flex-1 space-y-5">
        <Field label={t('company.branches.name')} error={error ?? undefined}>
          {(p) => (
            <Input
              {...p}
              maxLength={200}
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
            />
          )}
        </Field>
        <Field label={t('company.branches.timeZone')} hint={t('company.branches.timeZoneHint')}>
          {(p) => (
            <Select {...p} value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {branch && (
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--color-signal)]" checked={isActive} onChange={(e) => setActive(e.target.checked)} />
            <span>
              {t('company.branches.active')}
              <span className="block text-ink-soft">{t('company.branches.activeHint')}</span>
            </span>
          </label>
        )}
      </div>
      <div className="sticky bottom-0 -mx-6 mt-8 -mb-5 flex justify-end gap-2 border-t border-line bg-panel px-6 pt-4 pb-5">
        <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={save.isPending}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  )
}

function KioskSheet({
  target,
  branches,
  onClose,
  onCreated,
}: {
  target: KioskInfo | 'new' | null
  branches: BranchSettings[]
  onClose: () => void
  onCreated: (result: KioskWithPassword) => void
}) {
  const { t } = useTranslation()
  const kiosk = target === 'new' ? null : target
  return (
    <Sheet open={!!target} onClose={onClose} closeLabel={t('common.close')} title={kiosk ? t('company.kiosks.editTitle') : t('company.kiosks.add')} description={kiosk?.email}>
      {target && <KioskForm key={kiosk?.id ?? 'new'} kiosk={kiosk} branches={branches} onClose={onClose} onCreated={onCreated} />}
    </Sheet>
  )
}

function KioskForm({
  kiosk,
  branches,
  onClose,
  onCreated,
}: {
  kiosk: KioskInfo | null
  branches: BranchSettings[]
  onClose: () => void
  onCreated: (result: KioskWithPassword) => void
}) {
  const { t } = useTranslation()
  const create = useCreateKiosk()
  const update = useUpdateKiosk()
  const [name, setName] = useState(kiosk?.name ?? t('company.kiosks.defaultName'))
  const [branchId, setBranchId] = useState(kiosk?.branchId ?? branches[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const saving = create.isPending || update.isPending
  const options = kiosk && !branches.some((b) => b.id === kiosk.branchId) ? [{ id: kiosk.branchId, name: kiosk.branchName ?? '' }, ...branches] : branches

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (name.trim().length < 2) return setError(t('errors.required'))
    try {
      if (kiosk) {
        await update.mutateAsync({ id: kiosk.id, name: name.trim(), branchId })
        toast.success(t('company.kiosks.saved'))
        onClose()
      } else {
        onCreated(await create.mutateAsync({ name: name.trim(), branchId }))
      }
    } catch (err) {
      toast.error(errorMessage(err, t))
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-full flex-col">
      <div className="flex-1 space-y-5">
        <Field label={t('company.kiosks.name')} hint={t('company.kiosks.nameHint')} error={error ?? undefined}>
          {(p) => (
            <Input
              {...p}
              maxLength={100}
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
            />
          )}
        </Field>
        <Field label={t('company.kiosks.branch')}>
          {(p) => (
            <Select {...p} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {options.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="sticky bottom-0 -mx-6 mt-8 -mb-5 flex justify-end gap-2 border-t border-line bg-panel px-6 pt-4 pb-5">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={saving}>
          {kiosk ? t('common.save') : t('company.kiosks.create')}
        </Button>
      </div>
    </form>
  )
}

/** Kiosk hesabının giriş bilgileri: yalnızca bir kez gösterilir. */
function KioskCredentialsDialog({ value, onClose }: { value: { result: KioskWithPassword; mode: 'created' | 'reset' } | null; onClose: () => void }) {
  const { t } = useTranslation()
  const address = `${window.location.origin}/giris`
  return (
    <Dialog open={!!value} onClose={onClose} title={t('company.kiosks.credentialsTitle')} maxWidth="max-w-lg">
      {value && (
        <>
          <p className="text-ink-soft">
            {t(value.mode === 'created' ? 'company.kiosks.credentialsCreated' : 'company.kiosks.credentialsReset', { name: value.result.kiosk.name })}
          </p>
          <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm">
            <li>{t('company.kiosks.step1')}</li>
            <li>{t('company.kiosks.step2')}</li>
            <li>{t('company.kiosks.step3')}</li>
          </ol>
          <dl className="mt-5 space-y-3 rounded-xl bg-panel-2 p-4 ring-1 ring-line">
            <CopyRow label={t('company.kiosks.address')} value={address} />
            <CopyRow label={t('users.tempPassword.email')} value={value.result.kiosk.email} />
            <CopyRow label={t('users.tempPassword.password')} value={value.result.password} emphasize />
          </dl>
          <p className="mt-4 flex gap-2.5 rounded-xl bg-pause-soft p-3.5 text-sm text-pause">
            <KeyRound className="mt-0.5 size-4 shrink-0" />
            {t('company.kiosks.once')}
          </p>
          <div className="mt-6 flex justify-end">
            <Button onClick={onClose} data-autofocus>
              {t('users.tempPassword.done')}
            </Button>
          </div>
        </>
      )}
    </Dialog>
  )
}
