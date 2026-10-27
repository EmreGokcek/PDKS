import { AnimatePresence, motion } from 'motion/react'
import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthContext'
import { PageHeader } from '../../components/AppShell'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { Segmented } from '../../components/ui/Segmented'
import { Spinner } from '../../components/ui/Spinner'
import { errorMessage } from '../../lib/api'
import { useReview, useTeamRequests, type StaffRequest } from './api'
import { RequestCard } from './RequestCard'

/** Yöneticinin talep ekranı: bekleyenler ve geçmiş. */
export function RequestsPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'pending' | 'history'>('pending')
  const query = useTeamRequests(tab === 'pending' ? 'Pending' : null)
  const items = (query.data ?? []).filter((r) => (tab === 'pending' ? r.status === 'Pending' : r.status !== 'Pending'))

  return (
    <>
      <PageHeader title={t('requests.title')} />
      <div className="mb-5">
        <Segmented
          label={t('requests.title')}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'pending', label: t('requests.pending') },
            { value: 'history', label: t('requests.history') },
          ]}
        />
      </div>

      {query.isPending ? (
        <div className="grid place-items-center py-24 text-ink-soft">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-2xl bg-panel p-8 text-center text-ink-soft ring-1 ring-line">
          {tab === 'pending' ? t('requests.emptyPending') : t('requests.emptyHistory')}
        </p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          <AnimatePresence initial={false}>
            {items.map((r) => (
              <motion.li key={r.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}>
                <RequestCard request={r} showName>
                  {r.status === 'Pending' && <ReviewBar request={r} />}
                </RequestCard>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </>
  )
}

function ReviewBar({ request }: { request: StaffRequest }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const review = useReview()
  const [note, setNote] = useState('')

  if (request.userId === user?.id) return <p className="text-sm text-ink-soft">{t('requests.own')}</p>

  async function decide(approve: boolean) {
    try {
      await review.mutateAsync({ id: request.id, approve, note })
      toast.success(approve ? t('requests.approved') : t('requests.rejected'))
    } catch (err) {
      toast.error(errorMessage(err, t))
    }
  }

  const busy = review.isPending
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('requests.notePlaceholder')} maxLength={500} className="min-w-40 flex-1 py-2" />
      <Button variant="secondary" size="sm" onClick={() => decide(false)} loading={busy && review.variables?.approve === false} disabled={busy}>
        <X className="size-4" />
        {t('requests.reject')}
      </Button>
      <Button size="sm" onClick={() => decide(true)} loading={busy && review.variables?.approve === true} disabled={busy}>
        <Check className="size-4" />
        {t('requests.approve')}
      </Button>
    </div>
  )
}
