import { AnimatePresence, motion } from 'motion/react'
import { KeyRound, MoreHorizontal, Pencil, Plus, Power, Search, UserRoundX } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { PageHeader } from '../../components/AppShell'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Button, IconButton } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Field'
import { Menu, type MenuItem } from '../../components/ui/Menu'
import { Segmented } from '../../components/ui/Segmented'
import { Spinner } from '../../components/ui/Spinner'
import { useDebounced } from '../../hooks/useDebounced'
import { errorMessage } from '../../lib/api'
import { relativeTime } from '../../lib/format'
import {
  useResetStaffPassword,
  useSetStaffActive,
  useStaffList,
  type ManagedRole,
  type StaffFilters,
  type StaffMember,
  type StaffWithPassword,
} from './api'
import { ConfirmDialog, TempPasswordDialog } from './Dialogs'
import { UserSheet } from './UserSheet'

type Pending = { kind: 'deactivate' | 'reset'; member: StaffMember } | null

/** Personel listesi. Admin için tam yönetim, müdür için salt okunur. */
export function UsersPage({ readOnly = false }: { readOnly?: boolean }) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<StaffFilters['role']>('all')
  const [status, setStatus] = useState<StaffFilters['status']>('active')
  const filters: StaffFilters = { search: useDebounced(search), role, status }
  const list = useStaffList(filters)

  const [sheet, setSheet] = useState<{ open: boolean; member: StaffMember | null }>({ open: false, member: null })
  const [password, setPassword] = useState<{ result: StaffWithPassword; mode: 'created' | 'reset' } | null>(null)
  const [pending, setPending] = useState<Pending>(null)

  const setActive = useSetStaffActive()
  const resetPassword = useResetStaffPassword()

  const openCreate = () => setSheet({ open: true, member: null })
  const openEdit = (member: StaffMember) => setSheet({ open: true, member })
  const closeSheet = () => setSheet((s) => ({ ...s, open: false }))

  async function activate(member: StaffMember) {
    try {
      await setActive.mutateAsync({ id: member.id, active: true })
      toast.success(t('users.confirm.activated', { name: member.fullName }))
    } catch (err) {
      toast.error(errorMessage(err, t))
    }
  }

  async function confirmPending() {
    if (!pending) return
    try {
      if (pending.kind === 'deactivate') {
        await setActive.mutateAsync({ id: pending.member.id, active: false })
        toast.success(t('users.confirm.deactivated', { name: pending.member.fullName }))
      } else {
        const result = await resetPassword.mutateAsync(pending.member.id)
        setPassword({ result, mode: 'reset' })
      }
      setPending(null)
    } catch (err) {
      toast.error(errorMessage(err, t))
    }
  }

  const rowActions = (member: StaffMember): MenuItem[] => [
    { label: t('common.edit'), icon: <Pencil className="size-4" />, onSelect: () => openEdit(member) },
    { label: t('users.resetPassword'), icon: <KeyRound className="size-4" />, onSelect: () => setPending({ kind: 'reset', member }) },
    member.isActive
      ? { label: t('users.deactivate'), icon: <UserRoundX className="size-4" />, tone: 'danger', onSelect: () => setPending({ kind: 'deactivate', member }) }
      : { label: t('users.activate'), icon: <Power className="size-4" />, onSelect: () => void activate(member) },
  ]

  const members = list.data ?? []
  const hasFilters = !!search || role !== 'all' || status !== 'active'

  return (
    <>
      <PageHeader
        title={readOnly ? t('users.teamTitle') : t('users.title')}
        subtitle={list.data ? t('users.count', { count: members.length }) : ' '}
        actions={
          !readOnly && (
            <Button onClick={openCreate}>
              <Plus className="size-[18px]" />
              {t('users.add')}
            </Button>
          )
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('users.search')}
            aria-label={t('users.search')}
            className="pl-10"
          />
        </div>
        <div className="overflow-x-auto">
          <Segmented<StaffFilters['role']>
            label={t('users.columns.role')}
            value={role}
            onChange={setRole}
            options={[
              { value: 'all', label: t('common.all') },
              ...(['Employee', 'Manager', 'Admin'] as ManagedRole[]).map((r) => ({ value: r, label: t(`roles.${r}`) })),
            ]}
          />
        </div>
        <Select
          aria-label={t('users.columns.status')}
          value={status}
          onChange={(e) => setStatus(e.target.value as StaffFilters['status'])}
          className="w-auto py-2"
        >
          <option value="active">{t('users.statusActive')}</option>
          <option value="inactive">{t('users.statusInactive')}</option>
          <option value="all">{t('common.all')}</option>
        </Select>
      </div>

      <section className="overflow-hidden rounded-2xl bg-panel ring-1 ring-line">
        {/* Masaüstü tablo başlığı */}
        <div className="hidden grid-cols-[minmax(0,2.2fr)_1fr_1fr_1fr_1fr_44px] gap-4 border-b border-line px-5 py-3 text-sm text-ink-soft md:grid">
          <span>{t('users.columns.person')}</span>
          <span>{t('users.columns.role')}</span>
          <span>{t('users.columns.employeeNumber')}</span>
          <span>{t('users.columns.status')}</span>
          <span>{t('users.columns.lastLogin')}</span>
          <span className="sr-only">{t('users.actions')}</span>
        </div>

        {list.isPending ? (
          <div className="grid place-items-center py-20 text-ink-soft">
            <Spinner />
          </div>
        ) : list.isError ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-ink-soft">{errorMessage(list.error, t)}</p>
            <Button variant="secondary" size="sm" onClick={() => list.refetch()}>
              {t('common.retry')}
            </Button>
          </div>
        ) : members.length === 0 ? (
          <EmptyState text={hasFilters ? t('users.empty') : t('users.emptyAll')} action={!readOnly && !hasFilters ? openCreate : undefined} />
        ) : (
          <ul className={`divide-y divide-line transition-opacity ${list.isPlaceholderData ? 'opacity-60' : ''}`}>
            <AnimatePresence initial={false}>
              {members.map((m, i) => (
                <motion.li
                  key={m.id}
                  layout="position"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 10) * 0.025 } }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                >
                  <StaffRow member={m} readOnly={readOnly} onOpen={() => !readOnly && openEdit(m)} actions={rowActions(m)} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      {!readOnly && (
        <>
          <UserSheet
            open={sheet.open}
            member={sheet.member}
            onClose={closeSheet}
            onCreated={(result) => {
              closeSheet()
              setPassword({ result, mode: 'created' })
            }}
          />
          <TempPasswordDialog result={password?.result ?? null} mode={password?.mode ?? 'created'} onClose={() => setPassword(null)} />
          <ConfirmDialog
            open={!!pending}
            onClose={() => setPending(null)}
            loading={setActive.isPending || resetPassword.isPending}
            onConfirm={confirmPending}
            tone={pending?.kind === 'deactivate' ? 'danger' : 'primary'}
            title={
              pending?.kind === 'deactivate'
                ? t('users.confirm.deactivateTitle', { name: pending.member.fullName })
                : t('users.confirm.resetTitle', { name: pending?.member.fullName ?? '' })
            }
            body={pending?.kind === 'deactivate' ? t('users.confirm.deactivateBody') : t('users.confirm.resetBody')}
            confirmLabel={pending?.kind === 'deactivate' ? t('users.deactivate') : t('users.resetPassword')}
          />
        </>
      )}
    </>
  )
}

function StaffRow({
  member: m,
  readOnly,
  onOpen,
  actions,
}: {
  member: StaffMember
  readOnly: boolean
  onOpen: () => void
  actions: MenuItem[]
}) {
  const { t } = useTranslation()
  const roleTone = m.role === 'Admin' ? 'brand' : m.role === 'Manager' ? 'pause' : 'neutral'

  const status = !m.isActive ? (
    <Badge tone="overrun" dot>
      {t('users.statusInactive')}
    </Badge>
  ) : m.mustChangePassword ? (
    <Badge tone="pause" dot>
      {t('users.pendingPassword')}
    </Badge>
  ) : (
    <Badge tone="signal" dot>
      {t('users.statusActive')}
    </Badge>
  )

  return (
    <div
      className={`group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 transition-colors md:grid-cols-[minmax(0,2.2fr)_1fr_1fr_1fr_1fr_44px] ${readOnly ? '' : 'cursor-pointer hover:bg-panel-2/70'} ${m.isActive ? '' : 'text-ink-soft'}`}
      onClick={onOpen}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={m.fullName} muted={!m.isActive} />
        <div className="min-w-0">
          <p className="truncate font-medium">{m.fullName}</p>
          <p className="truncate text-sm text-ink-soft">{m.email}</p>
        </div>
      </div>

      {/* Mobilde sağ üstte işlemler */}
      <div className="md:hidden" onClick={(e) => e.stopPropagation()}>
        {!readOnly && <RowMenu actions={actions} />}
      </div>

      <div className="col-span-2 flex flex-wrap items-center gap-2 md:contents">
        <span className="md:block">
          <Badge tone={roleTone}>{t(`roles.${m.role}`)}</Badge>
        </span>
        <span className="hidden text-sm tabular md:block">{m.employeeNumber ?? '—'}</span>
        <span className="md:block">{status}</span>
        <span className="text-sm text-ink-soft md:block">
          <span className="md:hidden">· </span>
          {m.lastLoginAt ? relativeTime(m.lastLoginAt) : t('common.never')}
        </span>
      </div>

      <div className="hidden justify-end md:flex" onClick={(e) => e.stopPropagation()}>
        {!readOnly && <RowMenu actions={actions} />}
      </div>
    </div>
  )
}

function RowMenu({ actions }: { actions: MenuItem[] }) {
  const { t } = useTranslation()
  return (
    <Menu
      items={actions}
      trigger={(props) => (
        <IconButton label={t('users.actions')} {...props} className="opacity-70 group-hover:opacity-100">
          <MoreHorizontal className="size-5" />
        </IconButton>
      )}
    />
  )
}

function EmptyState({ text, action }: { text: string; action?: () => void }) {
  const { t } = useTranslation()
  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-panel-2 ring-1 ring-line">
        <Search className="size-6 text-ink-soft" />
      </div>
      <p className="max-w-xs text-ink-soft">{text}</p>
      {action && (
        <Button onClick={action} size="sm">
          <Plus className="size-4" />
          {t('users.add')}
        </Button>
      )}
    </motion.div>
  )
}
