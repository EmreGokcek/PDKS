import { AnimatePresence, motion } from 'motion/react'
import { Check, Copy, KeyRound } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Overlay'
import type { StaffWithPassword } from './api'

/** Geçici şifreyi bir kez gösteren pencere. */
export function TempPasswordDialog({
  result,
  mode,
  onClose,
}: {
  result: StaffWithPassword | null
  mode: 'created' | 'reset'
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={!!result} onClose={onClose} title={t('users.tempPassword.title')}>
      {result && (
        <>
          <p className="text-ink-soft">
            {mode === 'created'
              ? t('users.tempPassword.createdFor', { name: result.user.fullName })
              : t('users.tempPassword.resetFor', { name: result.user.fullName })}
          </p>
          <dl className="mt-5 space-y-3 rounded-xl bg-panel-2 p-4 ring-1 ring-line">
            <CopyRow label={t('users.tempPassword.email')} value={result.user.email} />
            <CopyRow label={t('users.tempPassword.password')} value={result.temporaryPassword} emphasize />
          </dl>
          <p className="mt-4 flex gap-2.5 rounded-xl bg-pause-soft p-3.5 text-sm text-pause">
            <KeyRound className="mt-0.5 size-4 shrink-0" />
            {t('users.tempPassword.warning')}
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

export function CopyRow({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <dt className="text-xs text-ink-soft">{label}</dt>
        <dd className={`truncate ${emphasize ? 'font-mono text-xl tracking-wider' : 'font-medium'}`}>{value}</dd>
      </div>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard?.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1600)
        }}
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-panel px-2.5 text-sm text-ink-soft transition-colors hover:text-ink"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={copied ? 'done' : 'copy'}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.12 }}
          >
            {copied ? <Check className="size-4 text-signal" /> : <Copy className="size-4" />}
          </motion.span>
        </AnimatePresence>
        {copied ? t('common.copied') : t('common.copy')}
      </button>
    </div>
  )
}

/** Geri alınması zor işlemler için onay penceresi. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  tone = 'primary',
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: ReactNode
  body: ReactNode
  confirmLabel: string
  tone?: 'primary' | 'danger'
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p className="text-ink-soft">{body}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          {t('common.cancel')}
        </Button>
        <Button variant={tone} onClick={onConfirm} loading={loading} data-autofocus>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  )
}
