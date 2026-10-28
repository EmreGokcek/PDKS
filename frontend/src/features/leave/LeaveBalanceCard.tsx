import { CalendarHeart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatDay } from '../../lib/dates'
import { useMyLeaveBalance } from './api'

/** Personelin yıllık izin bakiyesi: kullanılabilir gün ve dökümü; ilk yılını doldurmayana ne zaman hak kazanacağı. */
export function LeaveBalanceCard() {
  const { t } = useTranslation()
  const q = useMyLeaveBalance()
  if (!q.data) return null
  const b = q.data
  const date = (iso: string) => formatDay(iso, { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <section className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl bg-panel p-5 ring-1 ring-line">
      <div className="flex items-center gap-4">
        <span className="grid size-11 place-items-center rounded-2xl bg-[#0ea5b7]/12 text-[#0b7f8c] dark:text-[#5fd3e0]">
          <CalendarHeart className="size-5" />
        </span>
        <div>
          <p className="text-sm text-ink-soft">{t('leave.balance.title')}</p>
          {b.hireDate ? (
            <p className="text-2xl font-semibold tracking-tight">{t('leave.balance.available', { count: b.available })}</p>
          ) : (
            <p className="font-medium">{t('leave.balance.noHireDate')}</p>
          )}
        </div>
      </div>

      {b.hireDate && b.serviceYears === 0 && b.adjustments <= 0 ? (
        <p className="max-w-md text-sm text-ink-soft">
          {t('leave.balance.firstYear', { date: date(b.nextEarnedOn!), days: b.nextDays })}
        </p>
      ) : b.hireDate ? (
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Stat label={t('leave.balance.earned')} value={b.earned} />
          {b.adjustments !== 0 && <Stat label={t('leave.balance.adjustments')} value={b.adjustments > 0 ? `+${b.adjustments}` : b.adjustments} />}
          <Stat label={t('leave.balance.used')} value={b.used} />
          {b.pending > 0 && <Stat label={t('leave.balance.pending')} value={b.pending} />}
          {b.nextEarnedOn && (
            <div>
              <dt className="text-ink-soft">{t('leave.balance.next')}</dt>
              <dd className="font-medium">{t('leave.balance.nextValue', { date: date(b.nextEarnedOn), days: b.nextDays })}</dd>
            </div>
          )}
        </dl>
      ) : null}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt className="text-ink-soft">{label}</dt>
      <dd className="tabular font-medium">{value}</dd>
    </div>
  )
}
